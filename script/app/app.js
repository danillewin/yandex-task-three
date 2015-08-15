app = {};

app.vm = {};

app.getRandomInt = function (min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Number.prototype.formatTime = function () {
    var hours   = Math.floor(this / 3600),
        minutes = Math.floor((this - (hours * 3600)) / 60),
        seconds = Math.floor(this - (hours * 3600) - (minutes * 60));

    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    return minutes + ':' + seconds;
}
