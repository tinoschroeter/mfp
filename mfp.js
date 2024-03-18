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

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    client.sendCommand(cmd("pause", [1]), (err, _msg) => {
      if (err) throw err;
    });
  } else {
    client.sendCommand(cmd("play", []), (err, _msg) => {
      if (err) throw err;
    });
  }
  musicState = !musicState;
};

const jump = (seconds) => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    if (err) throw err;
    const status = mpd.parseKeyValueMessage(msg);
    if (status.state === "play") {
      const currentTime = parseInt(status.elapsed.split(".")[0], 10);
      const newPosition = currentTime + seconds;
      client.sendCommand(cmd("seekcur", [`${newPosition}`]), (err) => {
        if (err) throw err;
      });
    }
  });
};

const screen = blessed.screen({
  smartCSR: true,
  title: "Music For Programming",
});

const feedList = blessed.list({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: "71%",
  keys: true,
  label: " Press ? for help ",
  border: { type: "line" },
  padding: { left: 1 },
  noCellBorders: true,
  invertSelected: false,
  scrollbar: {
    ch: " ",
    style: { bg: "blue" },
    track: {
      style: { bg: "grey" },
    },
  },
  style: {
    item: { hover: { bg: "blue" } },
    selected: { fg: "black", bg: "blue", bold: true },
    label: {
      fg: "lightgrey",
    },
  },
});

const description = blessed.box({
  parent: feedList,
  top: "71%",
  left: "0%",
  width: "100%",
  height: "18%",
  tags: true,
  label: " Description ",
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
      fg: "lightgrey",
    },
  },
});

const playerLeft = blessed.box({
  parent: feedList,
  top: "89%",
  left: "0",
  width: "67%",
  height: "11%",
  valign: "middle",
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
      fg: "lightgrey",
    },
  },
});

const playerRight = blessed.box({
  parent: feedList,
  top: "89%",
  left: "67%",
  width: "35%-2",
  height: "11%",
  align: "center",
  valign: "middle",
  tags: true,
  label: " Statistic ",
  border: {
    type: "line",
  },
  style: {
    fg: "white",
    border: {
      fg: "white",
    },
    label: {
      fg: "lightgrey",
    },
  },
});

const helpBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "50%",
  height: "35%",
  label: " Help ",
  content: `q|Esc          Detach mfp from the MPD server
ENTER          Start playing at this file
SPACE          Pause/Play
j              Move down in the list
k              Move up in the list
h              Jump back 10 seconds
l              Jump forward 10 seconds
?              Help
q              Quit
`,
  border: { type: "line" },
  style: {
    border: { fg: "white" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
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
    const items = feed.items.map((item, index) => {
      music[item.title] = {
        id: index,
        content: item.content,
        mp3: item.comments,
        pubDate: item.pubDate,
      };
      return item.title;
    });
    feedList.setItems(items);
    screen.render();
  } catch (error) {
    console.error("Error loading the RSS feed.", error);
  }
}

const feed = process.env.MFP_FEED || "https://musicforprogramming.net/rss.xml";
loadAndDisplayFeed(feed);

const updateUi = () => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    if (err) throw err;
    const status = mpd.parseKeyValueMessage(msg);
    const elapsed = formatSeconds(status.elapsed);
    const duration = formatSeconds(status.duration);
    const state =
      status.state === "play"
        ? "{green-fg}[play]{/green-fg}"
        : "{red-fg}[pause]{/red-fg}";
    const bitrate = status.bitrate + " kbps";

    client.sendCommand(cmd("currentsong", []), (err, msg) => {
      if (err) throw err;
      const songInfo = mpd.parseKeyValueMessage(msg).Title;
      const artist = mpd.parseKeyValueMessage(msg).Artist;
      const selectedItem = feedList.getItem(feedList.selected).getContent();
      const content = `{bold}${state} ${songInfo} [${artist}]{/bold}`;
      const instruments = `{bold}{red-fg}[${elapsed} Time] [${duration} Length] [${bitrate}]{/red-fg}{/bold}`;

      playerLeft.setContent(content);
      playerRight.setContent(instruments);
      description.setContent(
        `{bold}{green-fg}${selectedItem}{/green-fg}{/bold}` +
          "\n" +
          music[selectedItem].content,
      );
      screen.render();
    });
  });
};

setInterval(updateUi, 1000);

screen.key(["space"], (_ch, _key) => {
  pausePlay();
});

screen.key("enter", () => {
  const selectedItem = feedList.getItem(feedList.selected).getContent();
  const mp3 = music[selectedItem].mp3;

  play(mp3);
});

screen.key("?", function () {
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

screen.key(["h"], (_ch, _key) => {
  jump(-10);
});

screen.key(["l"], (_ch, _key) => {
  jump(10);
});

screen.render();
