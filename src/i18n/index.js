const en = require("./en");
const es = require("./es");
const fr = require("./fr");
const pt = require("./pt");

const languages = {
  en,
  es,
  fr,
  pt,
};

function getLanguage(language) {
  return languages[language] || languages.en;
}

module.exports = {
  languages,
  getLanguage,
};