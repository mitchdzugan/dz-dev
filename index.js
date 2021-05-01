require("@babel/register");
const fuzzy = require('./fuzzy');

const clear = require('clear');
clear();
console.log("AAA");
const core = require('./core.jsx');
core.default();
