#!/usr/bin/env node

const blessed = require("blessed");
const RSSParser = require("rss-parser");
const parser = new RSSParser();

const mpd = require("mpd");
const cmd = mpd.cmd;
const client = mpd.connect({
  port: process.env.MFP_PORT || 6600,
  host: process.env.MFP_HOST || "localhost",
});

const data = {
  music: {},
  musicState: true,
  filterOpen: false,
  feed: "https://musicforprogramming.net/rss.xml",
  filter: process.env.MFP_FEED || [
    ["Music for programming", "https://musicforprogramming.net/rss.xml"],
    ["YouTube Songs", "https://musicbox.tino.sh/best_songs/music.rss"],
  ],
};

const formatSeconds = (totalSeconds) => {
  totalSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(totalSeconds / 60) || 0;
  const seconds = totalSeconds % 60 || 0;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const errorHandling = (message) => {
  screen.append(errorBox);
  errorBox.show();
  errorBox.setContent(message);
  screen.render();

  setTimeout(() => {
    errorBox.hide();
    screen.render();
  }, 2_000);
};

const infoHandler = (message) => {
  screen.append(infoBox);
  infoBox.show();
  infoBox.setContent(" " + message + " ");
  screen.render();

  setTimeout(() => {
    infoBox.hide();
    screen.render();
  }, 14_000);
};

const play = (streamUrl) => {
  client.sendCommand(cmd("clear", []), (err) => {
    if (err) return errorHandling(err);
    streamUrl.forEach((mp3) => {
      client.sendCommand(cmd("add", [mp3]), (err) => {
        if (err) return errorHandling(err);
      });
    });
    client.sendCommand(cmd("play", []), (err) => {
      if (err) return errorHandling(err);
    });
  });
};

const pausePlay = () => {
  if (data.musicState) {
    infoHandler(`Pause`);
    client.sendCommand(cmd("pause", [1]), (err, _msg) => {
      if (err) return errorHandling(err);
    });
  } else {
    infoHandler(`Play`);
    client.sendCommand(cmd("play", []), (err, _msg) => {
      if (err) return errorHandling(err);
    });
  }
  data.musicState = !data.musicState;
};

const jump = (seconds) => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    if (err) return errorHandling(err);
    const status = mpd.parseKeyValueMessage(msg);
    if (status.state === "play") {
      const currentTime = parseInt(status.elapsed.split(".")[0], 10);
      const newPosition = currentTime + seconds;
      client.sendCommand(cmd("seekcur", [`${newPosition}`]), (err) => {
        if (err) return errorHandling(err);
      });
    }
  });
};

const searchInList = (query) => {
  const items = feedList.items.map((item) => item.getContent());
  const index = items.findIndex((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );

  feedList.select(index !== -1 ? index : 0);
  screen.render();
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

const filter = blessed.list({
  parent: screen,
  top: "center",
  left: "center",
  width: "30%",
  height: "20%",
  keys: true,
  label: " RSS filter list ",
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
  hidden: true,
});

const infoBox = blessed.box({
  parent: screen,
  top: 2,
  right: 2,
  width: "shrink",
  height: "shrink",
  label: " Info ",
  border: { type: "line" },
  style: {
    border: { fg: "blue" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  hidden: true,
  tags: true,
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
  height: "50%",
  label: " Help ",
  content: ` q|Esc          Detach mfp from the MPD server
 ENTER          Start playing at this file
 SPACE          Pause/Play
 /              Search
 j              Move down in the list
 k              Move up in the list
 gg             Jump to the first item in the list
 G              Jump to the last item in the list
 f              Open feed list
 h              Jump back 10 seconds
 l              Jump forward 10 seconds
 n              Plays next song in the playlist.
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

const errorBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "70%",
  height: "37%",
  label: " Error ",
  content: "",
  border: { type: "line" },
  style: {
    border: { fg: "red" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  hidden: true,
});

const prompt = blessed.prompt({
  top: "center",
  left: "center",
  width: "50%",
  height: "20%",
  border: {
    type: "line",
  },
  style: {
    border: { fg: "white" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  label: " Search ",
  tags: true,
  keys: true,
  hidden: true,
});

screen.append(feedList);
screen.append(filter);
screen.append(playerLeft);
screen.append(playerRight);
screen.append(description);
screen.append(prompt);

const loadAndDisplayFeed = async (url) => {
  try {
    delete data.music;
    data.music = {};
    const feed = await parser.parseURL(url);
    const items = feed.items.map((item, index) => {
      data.music[item.title] = {
        id: index,
        content: item.content,
        mp3: item.comments ? item.comments : item.link,
        pubDate: item.pubDate,
      };
      return item.title;
    });
    feedList.setItems(items);
    screen.render();
  } catch (error) {
    errorHandling(error);
  }
};

loadAndDisplayFeed(data.feed);

const loadAndDisplayFilter = () => {
  const list = data.filter.map((item) => item[0]);
  filter.setItems(list);
};

loadAndDisplayFilter();

const updateUi = () => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    if (err) return errorHandling(err);
    const status = mpd.parseKeyValueMessage(msg);
    const elapsed = formatSeconds(status.elapsed);
    const duration = formatSeconds(status.duration);
    const bitrateNumber = status.bitrate || 0;
    const state =
      status.state === "play"
        ? "{green-fg}[play]{/green-fg}"
        : "{blue-fg}[pause]{/blue-fg}";
    const bitrate = bitrateNumber + " kbps";

    client.sendCommand(cmd("currentsong", []), (err, msg) => {
      if (err) return errorHandling(err);
      const songInfo = mpd.parseKeyValueMessage(msg)?.Title || "No Song info";
      const artist = mpd.parseKeyValueMessage(msg)?.Artist || "No Artist";
      const selectedItem = feedList.getItem(feedList.selected)?.getContent();
      const content = `{bold}${state} ${songInfo} [${artist}]{/bold}`;
      const instruments = `{bold}{blue-fg}[${elapsed} Time] [${duration} Length] [${bitrate}]{/blue-fg}{/bold}`;

      playerLeft.setContent(content);
      playerRight.setContent(instruments);
      description.setContent(
        `{bold}{green-fg}${selectedItem}{/green-fg}{/bold}` +
          "\n" +
          data.music[selectedItem]?.content,
      );
      screen.render();
    });
  });
};

setInterval(updateUi, 900);

screen.key(["f"], (_ch, _key) => {
  screen.append(filter);
  data.filterOpen = true;
  filter.show();
  screen.render();
});

screen.key(["space"], (_ch, _key) => {
  pausePlay();
});

screen.key("enter", () => {
  const selectedIndexFilter = filter.selected;
  if (!data.filterOpen) {
    const selectedItem = feedList.getItem(feedList.selected).getContent();

    const id = data.music[selectedItem].id;
    const list = Object.values(data.music);
    const playList = list
      .filter((item) => item.id >= id)
      .map((item) => item.mp3);

    infoHandler(`Add songs to playList`);
    play(playList);
  }
  if (selectedIndexFilter !== undefined) {
    if (data.filterOpen) {
      data.feed = data.filter[selectedIndexFilter][1];
      data.filterOpen = false;
      loadAndDisplayFeed(data.feed);
      filter.hide();
    }
  }
  screen.render();
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
  if (data.filterOpen) {
    data.filterOpen = false;
    filter.hide();
    screen.render();
    return;
  }
  return process.exit(0);
});

let firstGPressed = false;

screen.key(["g"], (_ch, _key) => {
  if (!firstGPressed) {
    firstGPressed = true;
    setTimeout(() => {
      if (firstGPressed) {
        firstGPressed = false;
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

screen.key("/", () => {
  prompt.input("", (_err, value) => {
    searchInList(value || "...");
  });
});

screen.key(["j"], (_ch, _key) => {
  if (data.filterOpen) {
    filter.down();
  } else {
    feedList.down();
  }
  screen.render();
});

screen.key(["k"], (_ch, _key) => {
  if (data.filterOpen) {
    filter.up();
  } else {
    feedList.up();
  }
  screen.render();
});

screen.key(["h"], (_ch, _key) => {
  jump(-10);
  infoHandler("Jump - 10s");
});

screen.key(["l"], (_ch, _key) => {
  jump(10);
  infoHandler("Jump + 10s");
});

screen.key(["n"], (_ch, _key) => {
  client.sendCommand(cmd("next", []), (err) => {
    if (err) return errorHandling(err);
    infoHandler("Play next Song");
  });
});

screen.render();
