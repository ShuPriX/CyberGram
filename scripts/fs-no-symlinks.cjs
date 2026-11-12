// Preloaded by scripts/next.mjs only on filesystems without symlink support (exFAT, FAT32).
//
// On those drives Node reports EISDIR when asked to read a link from an ordinary file, where
// every other filesystem reports EINVAL ("not a link"). Bundlers treat EINVAL as the normal
// answer and anything else as a fatal error, so the code is translated here. Nothing else
// about the fs module is changed.
const fs = require("node:fs");

const translate = (err) => {
  if (err && err.code === "EISDIR" && err.syscall === "readlink") {
    err.code = "EINVAL";
    err.message = err.message.replace("EISDIR: illegal operation on a directory", "EINVAL: invalid argument");
  }
  return err;
};

const { readlink, readlinkSync } = fs;
const readlinkPromise = fs.promises.readlink;

fs.readlink = function patchedReadlink(target, options, callback) {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? undefined : options;
  return readlink.call(fs, target, opts, (err, result) => cb(translate(err), result));
};
fs.readlinkSync = function patchedReadlinkSync(...args) {
  try {
    return readlinkSync.apply(fs, args);
  } catch (err) {
    throw translate(err);
  }
};
fs.promises.readlink = async function patchedReadlinkPromise(...args) {
  try {
    return await readlinkPromise.apply(fs.promises, args);
  } catch (err) {
    throw translate(err);
  }
};
