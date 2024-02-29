#!/usr/bin/env node

const blessed = require("blessed");
const RSSParser = require("rss-parser");
const parser = new RSSParser();
const music = {};
let musicState = false;

const mpd = require("mpd");
const cmd = mpd.cmd;
const client = mpd.connect({
  port: 6600,
  host: "localhost",
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
  height: "90%",
  keys: true,
  vi: true,
  label: " Music For Programming ",
  border: { type: "line" },
  padding: { left: 1 },
  style: {
    item: { hover: { bg: "blue" } },
    selected: { bg: "blue", bold: true },
    label: {
      fg: "green",
    },
  },
});

const player = blessed.box({
  top: "90%",
  left: "0",
  width: "100%",
  height: "10%",
  content: `> `,
  tags: true,
  label: " Player ",
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

const helpBox = blessed.box({
  top: "center",
  left: "center",
  width: "75%",
  height: "75%",
  label: "Help",
  content: "Help text: Press any key to close this message.",
  border: { type: "line" },
  style: {
    border: { fg: "white" },
    fg: "white",
  },
  hidden: true,
});

screen.append(feedList);
screen.append(player);

async function loadAndDisplayFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items.map((item) => item.title);
    feed.items.map((item) => {
      music[item.title] = {
        description: item.description,
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

loadAndDisplayFeed("https://musicforprogramming.net/rss.xml");

screen.key(["space"], (ch, key) => {
  pausePlay();
});
screen.key("enter", () => {
  const selectedItem = feedList.getItem(feedList.selected).getContent();
  const mp3 = music[selectedItem].mp3;

  play(mp3);
  player.setContent(`> {bold}${mp3}{/bold}: {red-fg}${selectedItem}{/red-fg}`);
  screen.render();
});

setInterval(() => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    let elapsed = null;
    let duration = null;
    let state = null;
    let bitrate = null;
    let audio = null;

    if (err) throw err;
    const status = mpd.parseKeyValueMessage(msg);
    elapsed = formatSeconds(status.elapsed);
    duration = formatSeconds(status.duration);
    state = status.state;
    bitrate = status.bitrate + " kbps";
    audio = status.audio;

    client.sendCommand(cmd("currentsong", []), (err, msg) => {
      if (err) throw err;
      const songInfo = mpd.parseKeyValueMessage(msg).Title;

      player.setContent(
        `> {bold}{green-fg}[${state}]{/green-fg} ${songInfo}{/bold}: {red-fg}${elapsed} ${duration} ${bitrate} ${audio}{/red-fg}`,
      );
      screen.render();
    });
  });
}, 500);

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

screen.key(["escape", "q"], (ch, key) => {
  return process.exit(0);
});

let firstGPressed = false;

screen.key(["g"], (ch, key) => {
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

screen.key(["G"], (ch, key) => {
  feedList.select(feedList.items.length - 1);
  screen.render();
});

screen.key(["j"], (ch, key) => {
  feedList.down();
  screen.render();
});

screen.key(["k"], (ch, key) => {
  feedList.up();
  screen.render();
});

screen.render();
