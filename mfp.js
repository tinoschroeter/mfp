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
  playList: {},
  playListOpen: true,
  playListEmpty: true,
  musicState: true,
  currentSongIndex: 0,
  filterOpen: false,
  feed: "https://musicforprogramming.net/rss.xml",
  filter: process.env.MFP_FEED || [
    ["Playlist", "playlist"],
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

const fs = require("fs");
const logger = (data) => {
  fs.writeFile("debugLog.json", data.toString(), (err) => {
    if (err) {
      console.error("Error writing the debugLog.json: ", err);
    }
  });
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
  infoBox.setContent(" {green-fg}" + message + "{/green-fg} ");
  screen.render();

  setTimeout(() => {
    infoBox.hide();
    screen.render();
  }, 4_000);
};

const play = (id) => {
  client.sendCommand(cmd("play", [id]), (err, _msg) => {
    if (err) return errorHandling(err);
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
  tags: true,
  label: " Press ? for help / Playlist ",
  border: { type: "line" },
  padding: { left: 1 },
  noCellBorders: true,
  invertSelected: false,
  scrollbar: {
    ch: " ",
    style: { bg: "magenta" },
    track: {
      style: { bg: "magenta" },
    },
  },
  style: {
    item: { hover: { bg: "magenta" } },
    selected: { fg: "black", bg: "light-magenta", bold: true },
    border: {
      fg: "magenta",
    },
    label: {
      fg: "lightblue",
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
    style: { bg: "magenta" },
    track: {
      style: { bg: "lightblue" },
    },
  },
  style: {
    item: { hover: { bg: "magenta" } },
    selected: { fg: "black", bg: "magenta", bold: true },
    border: {
      fg: "magenta",
    },
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
    border: { fg: "magenta" },
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
      fg: "magenta",
    },
    label: {
      fg: "lightblue",
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
      fg: "magenta",
    },
    label: {
      fg: "lightblue",
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
      fg: "magenta",
    },
    label: {
      fg: "lightblue",
    },
  },
});

const helpBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "50%",
  height: "60%",
  label: " Help ",
  tags: true,
  content: ` {bold}q|Esc{/bold}          {magenta-fg}Detach mfp from the MPD server{/magenta-fg}
 {bold}ENTER          {/bold}{magenta-fg}Start playing at this file{/magenta-fg}
 {bold}SPACE          {/bold}{magenta-fg}Pause/Play{/magenta-fg}
 {bold}/              {/bold}{magenta-fg}Search{/magenta-fg}
 {bold}j              {/bold}{magenta-fg}Move down in the list{/magenta-fg}
 {bold}k              {/bold}{magenta-fg}Move up in the list{/magenta-fg}
 {bold}gg             {/bold}{magenta-fg}Jump to the first item in the list{/magenta-fg}
 {bold}G              {/bold}{magenta-fg}Jump to the last item in the list{/magenta-fg}
 {bold}f              {/bold}{magenta-fg}Open feed list{/magenta-fg}
 {bold}h              {/bold}{magenta-fg}Jump back 10 seconds{/magenta-fg}
 {bold}l              {/bold}{magenta-fg}Jump forward 10 seconds{/magenta-fg}
 {bold}a              {/bold}{magenta-fg}Add song to the playList {/magenta-fg}
 {bold}d              {/bold}{magenta-fg}Delete song from the playList{/magenta-fg}
 {bold}c              {/bold}{magenta-fg}Remove the hole playList{/magenta-fg}
 {bold}n              {/bold}{magenta-fg}Plays next song in the playList{/magenta-fg}
 {bold}p              {/bold}{magenta-fg}Plays previous song in the playList{/magenta-fg}
 {bold}?              {/bold}{magenta-fg}Help{/magenta-fg}
 {bold}q              {/bold}{magenta-fg}Quit{/magenta-fg}
`,
  border: { type: "line" },
  style: {
    border: { fg: "magenta" },
    fg: "white",
    label: {
      fg: "lightblue",
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
      fg: "lightblue",
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
    border: { fg: "magenta" },
    fg: "white",
    label: {
      fg: "lightblue",
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

const removeAnsiSequences = (input) => input.replace(/\u001b\[.*?m/g, "");
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
    //logger(JSON.stringify(data));
    const keys = Object.keys(data.music);
    feedList.setLabel(
      ` Press ? for help / ${data.feed} (${keys.length} items) `,
    );
    feedList.setItems(items);
    screen.render();
  } catch (error) {
    errorHandling(error);
  }
};

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
        ? "{blue-fg}[play]{/blue-fg}"
        : "{magenta-fg}[pause]{/magenta-fg}";
    const bitrate = bitrateNumber + " kbps";

    client.sendCommand(cmd("currentsong", []), (err, msg) => {
      if (err) return errorHandling(err);
      const songInfo = mpd.parseKeyValueMessage(msg)?.Title || "No Song info";
      const artist = mpd.parseKeyValueMessage(msg)?.Artist || "No Artist";
      const selectedItem = feedList.getItem(feedList.selected)?.getContent();
      const content = `{bold}${state} ${songInfo} [${artist}]{/bold}`;
      const instruments = `{bold}{magenta-fg}[${elapsed} Time] [${duration} Length] [${bitrate}]{/magenta-fg}{/bold}`;

      playerLeft.setContent(content);
      playerRight.setContent(instruments);
      description.setContent(
        `{bold}{magenta-fg}${selectedItem}{/magenta-fg}{/bold}` +
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

  if (selectedIndexFilter !== undefined) {
    if (data.filterOpen) {
      data.feed = data.filter[selectedIndexFilter][1];
      if (data.feed === "playlist") {
        data.playListOpen = true;
        loadAndDisplayPlaylist();
      } else {
        data.playListOpen = false;
        loadAndDisplayFeed(data.feed);
        const keys = Object.keys(data.music);
        feedList.setLabel(
          ` Press ? for help / ${data.feed} (${keys.length} items) `,
        );
      }
      filter.hide();
    }
  }
  if (data.playListOpen && !data.filterOpen) {
    const selectedItem = feedList.getItem(feedList.selected).getContent();
    const id = data.playList[removeAnsiSequences(selectedItem)].id;

    play(id);
    data.musicState = true;

    infoHandler(selectedItem);
  }
  data.filterOpen = false;
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

screen.program.on("keypress", (_ch, key) => {
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

screen.key(["p"], (_ch, _key) => {
  client.sendCommand(cmd("previous", []), (err) => {
    if (err) return errorHandling(err);
    infoHandler("Play previous Song");
  });
});

screen.key(["a"], (_ch, _key) => {
  const selectedItem = feedList.getItem(feedList.selected).getContent();
  const mp3 = data.music[selectedItem].mp3;
  client.sendCommand(cmd("add", [mp3]), (err) => {
    if (err) return errorHandling(err);
    infoHandler(`Add ${selectedItem} to Playlist`);
  });
});

screen.key(["d"], (_ch, _key) => {
  if (!data.playListOpen) return;
  const selectedItem = feedList.getItem(feedList.selected)?.getContent();

  if (!selectedItem) {
    infoHandler("Nothing to delete");
    return;
  }
  const id = data.playList[selectedItem].id;
  client.sendCommand(cmd("delete", [id]), (err) => {
    if (err) return errorHandling(err);
    infoHandler(`Delete ${selectedItem} from Playlist`);
    loadAndDisplayPlaylist();
  });
});

screen.key(["c"], (_ch, _key) => {
  client.sendCommand(cmd("clear", []), (err) => {
    if (err) return errorHandling(err);
    infoHandler("Clear Playlist");
    feedList.setItems(["No Playlist"]);
  });
});

const loadAndDisplayPlaylist = () => {
  client.sendCommand(cmd("playlist", []), (err, msg) => {
    if (err) return errorHandling(err);
    const keys = msg
      .split("\n")
      .map((item) => item.split("/")[item.split("/").length - 1])
      .filter((item) => item.length);

    const links = msg
      .split("\n")
      .map((item) => item.split(" ")[1])
      .filter((item) => item);

    data.playListEmpty = keys.length;
    keys.forEach((item, i) => {
      data.playList[item] = {
        id: i,
        content: "",
        mp3: links[i],
        pubDate: "",
      };
    });

    const list = keys.map((item, index) => {
      return index == data.currentSongIndex
        ? `{green-fg}${item}{/green-fg}`
        : item;
    });
    feedList.setLabel(` Press ? for help / Playlist (${keys.length} items) `);
    feedList.setItems(list);
  });
};

client.on("system", (name) => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    const { song } = mpd.parseKeyValueMessage(msg);

    if (data.playListOpen) {
      data.currentSongIndex = song;
      loadAndDisplayPlaylist();
    }
  });
});

client.on("ready", () => {
  client.sendCommand(cmd("status", []), (err, msg) => {
    if (err) return errorHandling(err);
    const { state, song } = mpd.parseKeyValueMessage(msg);

    data.currentSongIndex = song;
    state === "play" ? (data.musicState = true) : (data.musicState = false);
    loadAndDisplayPlaylist();
  });

  setTimeout(() => {
    if (!data.playListEmpty) {
      screen.append(filter);
      data.filterOpen = true;
      filter.show();
    }
  }, 200);
});
screen.render();
