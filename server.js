const express = require("express");
const axios = require("axios");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { v4: uuidv4 } = require("uuid");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json({ limit: "100mb" }));

// -------------------------
// DOWNLOAD FILE FUNCTION
// -------------------------
async function downloadImage(url, filename) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
  });
  fs.writeFileSync(filename, response.data);
  return filename;
}

// -------------------------
// CREATE CROSSFADE VIDEO
// -------------------------
app.post("/create-video", async (req, res) => {
  try {
    const { images, duration = 6, transition = 1 } = req.body;

    if (!images || images.length < 2) {
      return res.status(400).json({ error: "Need at least 2 images." });
    }

    const folder = `temp_${uuidv4()}`;
    fs.mkdirSync(folder);

    // Download images
    const localImages = [];
    for (let i = 0; i < images.length; i++) {
      const file = `${folder}/img${i}.jpg`;
      await downloadImage(images[i], file);
      localImages.push(file);
    }

    // Create filter_complex for xfade chain
    let filter = "";
    let offset = duration - transition;

    for (let i = 0; i < localImages.length - 1; i++) {
      const inputA = i === 0 ? "0:v" : `[v${i}]`;
      const inputB = `${i + 1}:v`;
      const out = `v${i + 1}`;
      filter += `[${inputA}][${inputB}] xfade=transition=fade:duration=${transition}:offset=${offset} [${out}]; `;
      offset += duration - transition;
    }

    const output = `${folder}/final.mp4`;

    let command = ffmpeg();

    localImages.forEach(img => {
      command = command.addInput(img).loop(1).inputOptions([`-t ${duration}`]);
    });

    command
      .complexFilter(filter.trim())
      .output(output)
      .on("end", () => {
        res.download(output, "video.mp4", () => {
          fs.rmSync(folder, { recursive: true, force: true });
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "FFmpeg error", details: err.message });
      })
      .run();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("FFmpeg API running on port 3000"));
