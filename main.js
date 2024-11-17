const { app, BrowserWindow, dialog, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "/src/js/preload.js"),
    },
  });
  win.webContents.openDevTools();
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        {
          click: () => mainWindow.webContents.send("update-counter", 1),
          label: "Increment",
        },
        {
          click: () => mainWindow.webContents.send("update-counter", -1),
          label: "Decrement",
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
  win.loadFile(path.join(__dirname, "/src/view/index.html"));
  // dialog.showOpenDialog(win,{properties:['openFile']}).then(result=>{
  //   console.log(result)
  //   fs.readFile(result.filePaths[0],'utf8', (err, data) => {
  //     if (err) throw err;
  //     console.log(data);
  //   });
  // })
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  app.on("open-file", (event, path) => {
    console.log(path);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
