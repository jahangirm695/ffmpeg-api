const express = require("express");
const axios = require("axios");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { v4: uuidv4 } = require("uuid");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json({ limit: "100mb" }));

// Download image function
async function downloadImage(url, filename) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
  });
  fs.writeFileSync(filename, response.data);
  return filename;
}

// Simple /create-video route for 2 images only
app.post("/create-video", async (req, res) => {
  try {
    const { images, duration = 6, transition = 1 } = req.body;

    if (!images || images.length !== 2) {
      return res
        .status(400)
        .json({ error: "This simple test only accepts 2 images." });
    }

    const folder = `temp_${uuidv4()}`;
    fs.mkdirSync(folder);

    const localImages = [];
    for (let i = 0; i < 2; i++) {
      const file = `${folder}/img${i}.jpg`;
      await downloadImage(images[i], file);
      localImages.push(file);
    }

    const output = `${folder}/video.mp4`;

    ffmpeg()
      .addInput(localImages[0]).loop(1).inputOptions([`-t ${duration}`])
      .addInput(localImages[1]).loop(1).inputOptions([`-t ${duration}`])
      .complexFilter([
        `[0:v][1:v] xfade=transition=fade:duration=${transition}:offset=${duration - transition},format=yuv420p [v]`
      ])
      .outputOptions(["-map [v]"])
      .save(output)
      .on("end", () => {
        res.download(output, "video.mp4", () => {
          fs.rmSync(folder, { recursive: true, force: true });
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "FFmpeg error", details: err.message });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FFmpeg API running on port ${PORT}`));
