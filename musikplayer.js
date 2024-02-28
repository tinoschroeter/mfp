const blessed = require("blessed");
const RSSParser = require("rss-parser");
const parser = new RSSParser();

const { spawn } = require("child_process");
let mplayer;
let prevSong = "";
let status = false;

const startPlayer = () => {
  mplayer = spawn("mplayer", [
    "-slave",
    "-quiet",
    "https://datashat.net/music_for_programming_67-datassette.mp3",
  ]);

  mplayer.on("exit", (code) => {
    console.log(`MPlayer exited with code ${code}`);
  });
};

const sendCommand = (command) => {
  mplayer.stdin.write(command + "\n");
};

const nextSong = (songPath) => {
  sendCommand(`loadfile ${songPath}`);
};

startPlayer();

const music = {};

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
  label: "Music For Programming",
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
  content: `> {bold}play{/bold}: {red-fg}Episode 62: Our Grey Lives{/red-fg}`,
  tags: true,
  label: "Player",
  border: {
    type: "line",
  },
  padding: { left: 1 },
  style: {
    fg: "white",
    border: {
      fg: "#f0f0f0",
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
    console.error("Fehler beim Laden des RSS-Feeds:", error);
  }
}

loadAndDisplayFeed("https://musicforprogramming.net/rss.xml");

screen.key("space", () => {
  const selectedItem = feedList.getItem(feedList.selected).getContent();
  const mp3 = music[selectedItem].mp3;

  if (prevSong === selectedItem) {
    sendCommand("pause");
    status = !status;
  } else {
    prevSong = selectedItem;
    status = true;
    nextSong(mp3);
  }

  const play = status ? "play" : "pause";
  player.setContent(`> {bold}${play}{/bold}: {red-fg}${selectedItem}{/red-fg}`);
  screen.render();
});

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

screen.key(["+"], (ch, key) => {
  sendCommand("volume 10");
});

screen.key(["-"], (ch, key) => {
  sendCommand("volume -10");
});

screen.key(["escape", "q"], (ch, key) => {
  //mplayer.kill();
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
