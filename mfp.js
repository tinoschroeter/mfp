#!/usr/bin/env node

const blessed = require("blessed");
const RSSParser = require("rss-parser");
const parser = new RSSParser();
const music = {};
let musicState = false;

const mpd = require("mpd");
const cmd = mpd.cmd;
const client = mpd.connect({
  port: process.env.MFP_PORT || 6600,
  host: process.env.MFP_HOST || "localhost",
});

const formatSeconds = (totalSeconds) => {
  totalSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const minutesStr = minutes.toString().padStart(2, "0");
  const secondsStr = seconds.toString().padStart(2, "0");

  return `${minutesStr}:${secondsStr}`;
};

const play = (streamUrl) => {
  client.sendCommand(cmd("clear", []), (err) => {
    if (err) throw err;
    client.sendCommand(cmd("add", [streamUrl]), (err) => {
      if (err) throw err;
      client.sendCommand(cmd("play", []), (err) => {
        if (err) throw err;
      });
    });
  });
};

const pausePlay = () => {
  if (musicState) {
    client.sendCommand(cmd("pause", [1]), (err, msg) => {
      if (err) throw err;
    });
  } else {
    client.sendCommand(cmd("play", []), (err, msg) => {
      if (err) throw err;
    });
  }
  musicState = !musicState;
};

const screen = blessed.screen({
  smartCSR: true,
  title: "Music For Programming",
});

const feedList = blessed.list({
  top: 0,
  left: 0,
  width: "100%",
  height: "70%",
  keys: true,
  vi: true,
  label: "| Music For Programming |",
  border: { type: "line" },
  padding: { top: 1, left: 1 },
  style: {
    item: { hover: { bg: "blue" } },
    selected: { bg: "blue", bold: true },
    label: {
      fg: "green",
    },
  },
});

const description = blessed.box({
  top: "70%",
  left: "0%",
  width: "100%",
  height: "15%",
  content: ``,
  tags: true,
  label: "| Description |",
  border: {
    type: "line",
  },
  padding: { left: 1 },
  style: {
    fg: "white",
    border: {
      fg: "white",
    },
    label: {
      fg: "green",
    },
  },
});

const playerLeft = blessed.box({
  top: "85%",
  left: "0%",
  width: "66%",
  height: "12%",
  content: `> `,
  tags: true,
  label: "| Player |",
  border: {
    type: "line",
  },
  padding: { top: 1, left: 1 },
  style: {
    fg: "white",
    border: {
      fg: "white",
    },
    label: {
      fg: "green",
    },
  },
});

const playerRight = blessed.box({
  top: "85%",
  left: "66%",
  width: "34%",
  height: "12%",
  content: `> `,
  tags: true,
  label: "| Statistic |",
  border: {
    type: "line",
  },
  padding: { top: 1, left: 1 },
  style: {
    fg: "white",
    border: {
      fg: "white",
    },
    label: {
      fg: "green",
    },
  },
});

const helpBox = blessed.box({
  top: "center",
  left: "center",
  width: "75%",
  height: "75%",
  label: "Help",
  content: `q              Detach mfp from the MPD server
ENTER          Start playing at this file
h              Help
j              Move down in the list
k              Move up in the list
q              Quit
SPACE          Pause/Play
`,
  border: { type: "line" },
  style: {
    border: { fg: "white" },
    fg: "white",
  },
  hidden: true,
});

screen.append(feedList);
screen.append(playerLeft);
screen.append(playerRight);
screen.append(description);

async function loadAndDisplayFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items.map((item) => item.title);
    let count = 0;
    feed.items.map((item) => {
      music[item.title] = {
        id: count++,
        content: item.content,
        mp3: item.comments,
        pubDate: item.pubDate,
      };
    });
    feedList.setItems(items);
    screen.render();
  } catch (error) {
    console.error("Error loading the RSS feed.", error);
  }
}

const feed = process.env.MFP_FEED || "https://musicforprogramming.net/rss.xml";
loadAndDisplayFeed(feed);

screen.key(["space"], (_ch, _key) => {
  pausePlay();
});
screen.key("enter", () => {
  const selectedItem = feedList.getItem(feedList.selected).getContent();
  const mp3 = music[selectedItem].mp3;

  play(mp3);
});

const updateUi = () => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    let elapsed = null;
    let duration = null;
    let state = null;
    let bitrate = null;

    if (err) throw err;
    const status = mpd.parseKeyValueMessage(msg);
    elapsed = formatSeconds(status.elapsed);
    duration = formatSeconds(status.duration);
    state = status.state;
    bitrate = status.bitrate + " kbps";

    client.sendCommand(cmd("currentsong", []), (err, msg) => {
      if (err) throw err;
      const songInfo = mpd.parseKeyValueMessage(msg).Title;
      const artist = mpd.parseKeyValueMessage(msg).Artist;
      const content = `> {bold}{red-fg}[${state}]{/red-fg} ${songInfo} [${artist}]{/bold}`;
      const instruments = `{bold}{red-fg}[${elapsed} Time] [${duration} Length] [${bitrate}]{/red-fg}{/bold}`;

      const selectedItem = feedList.getItem(feedList.selected).getContent();
      playerLeft.setContent(content);
      playerRight.setContent(instruments);
      description.setContent(
        `{bold}${selectedItem}{/bold}` + "\n" + music[selectedItem].content,
      );
      screen.render();
    });
  });
};

setInterval(updateUi, 800);

screen.key("h", function () {
  if (helpBox.hidden) {
    screen.append(helpBox);
    helpBox.show();
    screen.render();

    screen.once("keypress", () => {
      helpBox.hide();
      screen.render();
    });
  }
});

screen.key(["escape", "q"], (_ch, _key) => {
  return process.exit(0);
});

let firstGPressed = false;

screen.key(["g"], (_ch, _key) => {
  if (!firstGPressed) {
    firstGPressed = true;
    setTimeout(() => {
      if (firstGPressed) {
        feedList.select(0);
        firstGPressed = false;
        screen.render();
      }
    }, 300);
  } else {
    feedList.select(0);
    firstGPressed = false;
    screen.render();
  }
});

screen.program.on("keypress", function (_ch, key) {
  if (key.name === "g" && key.shift) {
    feedList.select(feedList.items.length - 1);
    screen.render();
  }
});

screen.key(["j"], (_ch, _key) => {
  feedList.down();
  screen.render();
});

screen.key(["k"], (_ch, _key) => {
  feedList.up();
  screen.render();
});

screen.render();
