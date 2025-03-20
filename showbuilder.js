// fileUpload.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs"); // Regular fs for createWriteStream
const fsp = require("fs").promises; // Promise-based fs for other operations
const archiver = require("archiver");

// node backend.js --directories '[\"showbuilder\",\"C:/Users/megaf/Documents/OpenSpace/sync/url/showbuilder\",\"showbuilder/uploads\",\"C:/Users/megaf/Documents/OpenSpace/user/showbuilder/uploads\",\"showbuilder/projects\",\"C:/Users/megaf/Documents/OpenSpace/user/showbuilder/projects\"]' -p 5860

const setupShowbuilderRoutes = async (app, endpoints) => {
  if (!endpoints.uploads || !endpoints.projects) {
    console.log(
      "Required showbuilder endpoints are missing. Skipping showbuilder setup."
    );
    return;
  }
  const uploadDir = endpoints.uploads;
  const projectsDir = endpoints.projects;

  // Ensure upload directory exists
  await fsp.mkdir(uploadDir, { recursive: true }).catch(console.error);
  // Ensure projects directory exists
  await fsp.mkdir(projectsDir, { recursive: true }).catch(console.error);

  // Configure multer for image uploads
  const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  // Separate multer instances for different purposes
  const imageUpload = multer({
    storage: imageStorage,
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

  // Configure multer for zip uploads
  const zipStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const zipUpload = multer({
    storage: zipStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for zip files
    },
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype === "application/zip" ||
        file.mimetype === "application/x-zip-compressed"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only zip files are allowed!"));
      }
    },
  });

  // Upload endpoint
  app.post(
    "/showcomposer/api/upload",
    imageUpload.single("image"),
    (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      res.json({
        filePath: `/uploads/${req.file.filename}`,
        fileName: req.file.filename,
      });
    }
  );
  // node backend.js -d '["showcomposer","C:\\Users\\megaf\\Documents\\OpenSpace\\sync\\url\\showbuilder","showcomposer/uploads","C:\\Users\\megaf\\Documents\\OpenSpace\\user\\showbuilder\\uploads","showcomposer/projects","C:\\Users\\megaf\\Documents\\OpenSpace\\user\\showbuilder\\projects"]'
  // List all images endpoint
  app.get("/showcomposer/api/images", async (req, res) => {
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

  // // Serve uploaded files statically
  // app.use("/showbuilder/uploads", express.static(uploadDir));

  // Modified package endpoint to return zip file directly
  app.post("/showcomposer/api/package", express.json(), async (req, res) => {
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
          if (typeof value === "string" && value.includes("/uploads/")) {
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

  app.post(
    "/showcomposer/api/projects/save",
    express.json(),
    async (req, res) => {
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
    }
  );
  app.get("/showcomposer/api/projects", async (req, res) => {
    try {
      const files = await fsp.readdir(projectsDir);

      const projectList = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const filePath = path.join(projectsDir, file);
            const stats = await fsp.stat(filePath); // Get file statistics
            return {
              filePath: `./projects/${file}`, //this needs to be relative url
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

  app.post(
    "/showcomposer/api/projects/load",
    zipUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No zip file uploaded" });
        }

        // Create a temporary directory with unique ID for extraction
        const tempId = Date.now() + "_" + Math.round(Math.random() * 1e9);
        const tempDir = path.join(uploadDir, "temp_" + tempId);
        await fsp.mkdir(tempDir, { recursive: true });

        // Extract zip file
        const extract = require("extract-zip");
        await extract(req.file.path, { dir: tempDir });

        // Read and parse the data.json file
        const dataJsonPath = path.join(tempDir, "data.json");
        let projectData = JSON.parse(await fsp.readFile(dataJsonPath, "utf8"));

        // Add temp directory ID to project data for reference
        projectData._tempImportId = tempId;

        // Clean up the uploaded zip file
        await fsp.unlink(req.file.path);

        // Send back the project data with temp ID
        res.json(projectData);
      } catch (error) {
        console.error("Error processing uploaded project:", error);
        // Clean up temp directory if it exists
        if (tempDir) {
          await fsp
            .rm(tempDir, { recursive: true, force: true })
            .catch(console.error);
        }
        // Clean up uploaded file if it exists
        if (req.file?.path) {
          await fsp.unlink(req.file.path).catch(console.error);
        }
        res.status(500).json({ error: "Failed to process uploaded project" });
      }
    }
  );

  // New endpoint to confirm or reject an import
  app.post(
    "/showcomposer/api/projects/confirm-import",
    express.json(),
    async (req, res) => {
      try {
        const { tempId, confirm } = req.body;
        if (!tempId) {
          return res.status(400).json({ error: "Missing temporary import ID" });
        }

        const tempDir = path.join(uploadDir, "temp_" + tempId);

        // Check if the temp directory exists
        try {
          await fsp.access(tempDir);
        } catch (error) {
          return res
            .status(404)
            .json({ error: "Import session not found or expired" });
        }

        if (confirm) {
          // User confirmed import - process the files
          // Get list of existing images
          const existingImages = await fsp.readdir(uploadDir);
          const imageRenames = new Map(); // Track renamed images

          // Read the data.json again
          const dataJsonPath = path.join(tempDir, "data.json");
          let projectData = JSON.parse(
            await fsp.readFile(dataJsonPath, "utf8")
          );

          // Check for uploads directory and handle different possible structures
          const uploadedImagesDir = path.join(tempDir, "uploads");
          let uploadedImages = [];

          try {
            // Try to read the uploads directory
            uploadedImages = await fsp.readdir(uploadedImagesDir);
          } catch (err) {
            if (err.code === "ENOENT") {
              // If "uploads" directory doesn't exist, check if images are in root of zip
              const allFiles = await fsp.readdir(tempDir);
              uploadedImages = allFiles.filter(
                (file) =>
                  /\.(jpg|jpeg|png|gif)$/i.test(file) && file !== "data.json"
              );
              // If we found images in root, treat tempDir as the images directory
              if (uploadedImages.length > 0) {
                console.log("Found images in root of zip");
                // Note: we're assigning to a variable that was const
                // We'll use a different approach
                let imagesSourceDir = tempDir;

                // Process images if we found any
                for (const imageName of uploadedImages) {
                  let newImageName = imageName;

                  // If image already exists, create new unique name
                  if (existingImages.includes(imageName)) {
                    const ext = path.extname(imageName);
                    const baseName = path.basename(imageName, ext);
                    newImageName = `${baseName}_${Date.now()}${ext}`;
                    imageRenames.set(imageName, newImageName);
                  }

                  // Copy image to upload directory
                  await fsp.copyFile(
                    path.join(imagesSourceDir, imageName),
                    path.join(uploadDir, newImageName)
                  );
                }
              }
            } else {
              throw err; // Re-throw if it's a different error
            }
          }

          // Process images if we found them in the uploads directory
          if (uploadedImagesDir !== tempDir && uploadedImages.length > 0) {
            for (const imageName of uploadedImages) {
              let newImageName = imageName;

              // If image already exists, create new unique name
              if (existingImages.includes(imageName)) {
                const ext = path.extname(imageName);
                const baseName = path.basename(imageName, ext);
                newImageName = `${baseName}_${Date.now()}${ext}`;
                imageRenames.set(imageName, newImageName);
              }

              // Copy image to upload directory
              await fsp.copyFile(
                path.join(uploadedImagesDir, imageName),
                path.join(uploadDir, newImageName)
              );
            }
          }

          // Update image references in data.json if any images were renamed
          if (imageRenames.size > 0) {
            const jsonString = JSON.stringify(projectData);
            let updatedJsonString = jsonString;

            imageRenames.forEach((newName, oldName) => {
              updatedJsonString = updatedJsonString.replace(
                new RegExp(oldName, "g"),
                newName
              );
            });

            projectData = JSON.parse(updatedJsonString);
          }

          // Remove the temp ID from the project data
          delete projectData._tempImportId;

          // Clean up the temporary directory
          await fsp.rm(tempDir, { recursive: true, force: true });

          // Send the updated project data back
          res.json({ success: true, projectData });
        } else {
          // User rejected import - just delete the temp directory
          await fsp.rm(tempDir, { recursive: true, force: true });
          res.json({ success: true, message: "Import cancelled" });
        }
      } catch (error) {
        console.error("Error confirming/rejecting import:", error);
        res
          .status(500)
          .json({ error: "Failed to process import confirmation" });
      }
    }
  );
};

module.exports = setupShowbuilderRoutes;
