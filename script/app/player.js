(function (app) {

    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        app.AudioContext = new AudioContext();
    }

    catch(e) {
        alert('Web Audio API is not supported in this browser');
    }

    app.Events = new app.vm.Events();
    app.TrackList = new app.vm.TrackList();
    app.Player = new app.vm.Player();


    ko.applyBindings(app.TrackList, document.getElementsByClassName("track-list")[0]);
    ko.applyBindings(app.Player, document.getElementsByClassName("controls")[0]);
    ko.applyBindings(app.Player, document.getElementsByClassName("player__visual")[0]);

})(window.app);
