// fileUpload.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs"); // Regular fs for createWriteStream
const fsp = require("fs").promises; // Promise-based fs for other operations
const archiver = require("archiver");

const setupShowbuilderRoutes = async (app) => {
  // Define upload directory - adjust path as needed
  const uploadDir = path.join(__dirname, "uploads");

  // Define projects directory alongside upload directory
  const projectsDir = path.join(__dirname, "projects");
  // Ensure upload directory exists
  await fsp.mkdir(uploadDir, { recursive: true }).catch(console.error);

  // Ensure projects directory exists
  await fsp.mkdir(projectsDir, { recursive: true }).catch(console.error);

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"));
      }
    },
  });

  // Upload endpoint
  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({
      filePath: `/uploads/${req.file.filename}`,
      fileName: req.file.filename,
    });
  });

  // List all images endpoint
  app.get("/api/images", async (req, res) => {
    try {
      const files = await fsp.readdir(uploadDir);
      const images = files
        .filter((file) => /\.(jpg|jpeg|png|gif)$/i.test(file))
        .map((file) => `/uploads/${file}`);
      res.json({ images });
    } catch (error) {
      console.error("Error reading upload directory:", error);
      res.status(500).json({ error: "Failed to list images" });
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadDir));

  // Modified package endpoint to return zip file directly
  app.post("/api/package", express.json(), async (req, res) => {
    try {
      const jsonData = req.body;
      console.log("JSON Data: ", jsonData);
      const zipFileName = `${
        jsonData.settingsStore.projectName.replace(/ /g, "_") || "project"
      }-${Date.now()}.zip`;

      // Set up response headers for download
      res.attachment(zipFileName);

      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      // Pipe archive to the response
      archive.pipe(res);

      // Add the JSON file to the zip
      archive.append(JSON.stringify(jsonData, null, 2), { name: "data.json" });

      // Function to extract image URLs from JSON
      function extractImageUrls(obj) {
        const urls = new Set();
        JSON.stringify(obj, (key, value) => {
          if (typeof value === "string" && value.startsWith("/uploads/")) {
            urls.add(value);
          }
          return value;
        });
        return Array.from(urls);
      }

      // Get all image URLs from the JSON
      const imageUrls = extractImageUrls(jsonData);

      // Add each referenced image to the zip
      for (const imageUrl of imageUrls) {
        const fileName = imageUrl.split("/").pop();
        const filePath = path.join(uploadDir, fileName);

        try {
          // Use fsp for access
          await fsp.access(filePath);
          archive.file(filePath, { name: `uploads/${fileName}` });
        } catch (error) {
          console.warn(`Warning: Referenced image not found: ${fileName}`);
        }
      }

      // Finalize the zip file
      await archive.finalize();
    } catch (error) {
      console.error("Error creating package:", error);
      // If headers haven't been sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create package" });
      }
    }
  });

  // Serve project files statically
  app.use("/projects", express.static(projectsDir));

  app.post("/api/projects/save", express.json(), async (req, res) => {
    try {
      const projectData = req.body;
      const projectName =
        projectData.settingsStore.projectName.replace(/ /g, "_") || "project";
      if (!projectName || !projectData) {
        return res
          .status(400)
          .json({ error: "Project name and data are required." });
      }
      const projectFilePath = path.join(projectsDir, `${projectName}.json`);
      await fsp.writeFile(
        projectFilePath,
        JSON.stringify(projectData, null, 2)
      );
      res.status(201).json({ message: "Project saved successfully." });
    } catch (error) {
      console.error("Error saving project:", error);
      res.status(500).json({ error: "Failed to save project." });
    }
  });
  app.get("/api/projects", async (req, res) => {
    try {
      const files = await fsp.readdir(projectsDir);

      const projectList = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const filePath = path.join(projectsDir, file);
            const stats = await fsp.stat(filePath); // Get file statistics
            return {
              filePath: "/" + path.relative(process.cwd(), filePath),
              projectName: path.basename(file, ".json"),
              lastModified: stats.mtime, // Last modified date
              created: stats.birthtime, // Created date
            };
          })
      );
      res.json(projectList);
    } catch (error) {
      console.error("Error reading projects directory:", error);
      res.status(500).json({ error: "Failed to list projects." });
    }
  });
};

module.exports = setupShowbuilderRoutes;
