/*
 * Copyright 2014, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

// Start the main app logic.
requirejs(
  [ 'hft/commonui',
    'hft/gameclient',
    'hft/misc/input',
    'hft/misc/misc',
    'hft/misc/mobilehacks',
    'hft/misc/ticker',
    'hft/misc/touch',
    '../bower_components/hft-utils/dist/audio',
    '../bower_components/hft-utils/dist/imageloader',
    '../bower_components/hft-utils/dist/imageutils',
  ],
  function(
    CommonUI,
    GameClient,
    Input,
    Misc,
    MobileHacks,
    Ticker,
    Touch,
    AudioManager,
    ImageLoader,
    ImageProcess) {
  var g_client;
  var g_audioManager;
  var g_clock;
  var g_grid;
  var g_instrument;
  var g_leftRight = 0;
  var g_oldLeftRight = 0;
  var g_abutton = false;

  var globals = {
    debug: false,
    forceController: false,
  };
  Misc.applyUrlSettings(globals);
  MobileHacks.fixHeightHack();
  //MobileHacks.forceLandscape();

  function $(id) {
    return document.getElementById(id);
  }

  var statusElem = $("statusElem");
  var msgContainerStyle = $("msgcontainer").style;
  var msgText = Misc.createTextNode($("msg"));
  var msgContainerOriginalDisplay = msgContainerStyle.display;

  var flashNdx;
  var ticker = new Ticker();
  var cancelFlash = function() {
    ticker.cancel();
  };
  var flash = function(colors) {
    flashNdx = 0;
    cancelFlash();
    ticker.tick(2, 0.1, function() {
      msgContainerStyle.backgroundColor = colors[(flashNdx++) % colors.length];
    });
  };

  var showMsg = function(msg, color) {
    cancelFlash()
    msgContainerStyle.backgroundColor = color;
    msgContainerStyle.display = msgContainerOriginalDisplay;
    msgText.nodeValue = msg;
  };

  var hideMsg = function() {
    msgContainerStyle.display = "none";
  };

  var images = {
    tiles0:  { url: "assets/bomb_party-00.png", },
  };
  var avatarTileId = 0x0101;
  var bombTileId   = 0x0504;
  var flameTileIds = [
    0x0501, // flameH,
    0x0500, // flameL,
    0x0503, // flameR,
  ];

  var startClient = function() {
    var cutTile = function(xy, ii, size) {
      var tx = (((xy >> 0) & 0xFF)     );
      var ty = (((xy >> 8) & 0xFF) + ii);
      var img = ImageProcess.cropImage(images.tiles0.img, tx * 16, ty * 16, 16, 16);
      return img = ImageProcess.scaleImage(img, size, size);
    };

    images.avatars = [];
    for (var ii = 0; ii < 4; ++ii) {
      images.avatars.push(cutTile(avatarTileId, ii, 128));
    }
    images.bomb = cutTile(bombTileId, 0, 16);
    images.flames = [];
    for (var ii = 0; ii < flameTileIds.length; ++ii) {
      images.flames.push(cutTile(flameTileIds[ii], 0, 16));
    }

    g_client = new GameClient();

    var handleScore = function() {
    };

    var handleDeath = function() {
      showMsg("DEAD!", "red");
      flash(["red", "yellow"]);
    };

    var handleWinner = function() {
      showMsg("WINNER!!!", "yellow");
      flash(["green", "blue", "purple", "red", "orange", "yellow", "purple"]);
    };

    var handleTie = function() {
      showMsg("tie", "green");
    };

    var handleWaitForStart = function(data) {
      showMsg("Start In: " + data.waitTime, "blue");
    };

    var handleWaitForNextGame = function(data) {
      showMsg("Please Wait For Next Game", "orange");
    };

    var handleWaitForMorePlayers = function(data) {
      showMsg("Please Wait For More Players", "orange");
    };

    var handleStart = function() {
      hideMsg();
    };

    var handleSetColor = function(msg) {
      var canvas = $("avatar");
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");
      var frame = ImageProcess.adjustHSV(images.avatars[msg.set], msg.hsv[0], msg.hsv[1], msg.hsv[2]);
      ctx.drawImage(frame, 0, 0);
    };

    if (globals.forceController) {
      hideMsg();
    } else {
      // These messages hide/show the controller so don't handle them
      // if we're testing the controller with `forceController`
      g_client.addEventListener('score', handleScore);
      g_client.addEventListener('start', handleStart);
      g_client.addEventListener('tied', handleTie);
      g_client.addEventListener('died', handleDeath);
      g_client.addEventListener('winner', handleWinner);
      g_client.addEventListener('waitForStart', handleWaitForStart);
      g_client.addEventListener('waitForNextGame', handleWaitForNextGame);
      g_client.addEventListener('waitForMorePlayers', handleWaitForMorePlayers);
    }
    g_client.addEventListener('setColor', handleSetColor);

    var sounds = {};
    g_audioManager = new AudioManager(sounds);

    CommonUI.setupStandardControllerUI(g_client, globals);

    var handleAbutton = function(pressed) {
      if (g_abutton != pressed) {
        g_abutton = pressed;
        g_client.sendCmd('abutton', {
            abutton: pressed,
        });
      }
    };

    var handleShow = function(pressed) {
      g_client.sendCmd('show', {show:pressed});
    };

    var keys = { };
    keys["Z".charCodeAt(0)] = function(e) { handleAbutton(e.pressed); }
    keys["X".charCodeAt(0)] = function(e) { handleShow(e.pressed); }
    Input.setupKeys(keys);

    Touch.setupButtons({
      inputElement: $("buttons"),
      buttons: [
        { element: $("buttons"), callback: function(e) { handleAbutton(e.pressed); }, },
      ],
    });
  };

  ImageLoader.loadImages(images, startClient);


  var lerp = function(a, b, l) {
    return a + (b - a) * l;
  };

  var xPosition = 0;
  var oldXPosition = 0;

  setInterval(function() {
    if (xPosition != oldXPosition) {
      oldXPosition = xPosition;
      g_client.sendCmd('o', {
        x: xPosition,
      });
    }
  }, 33);


  var gatherDeviceOrientation = function(eventData) {

    var g = Math.abs(eventData.gamma);
    if (g > 180) {
      g = 360 - g;
    }
    if (g > 90) {
      g = 180 - g;
    }
    var verticalRotation   = g / 90;                  //  1 up, 0 = flat
    var div = lerp(5, 30, verticalRotation);

    var horizontalRotation = eventData.beta / div;    // -1 = left, +1 = right
    var flatRotation       = -eventData.alpha / 90;   // -1 = left, +1 = right

    var rot = horizontalRotation;

    if (statusElem) {
      statusElem.innerHTML =
        "ng: " + g.toFixed(1) +
        " g: " + eventData.gamma.toFixed(1) +
        " b: " + eventData.beta.toFixed(1) +
        " a: " + eventData.alpha.toFixed(1) +
        "dv: " + div.toFixed(1) +
        "rt: " + rot.toFixed(1);
    }

    var x = Math.floor(rot * 1000); // send an int as it's smaller
    xPosition = x;
    //g_client.sendCmd('o', {
    //  x: x,
    //  //b: eventData.beta,
    //  //g: eventData.gamma,
    //  //b: eventData.beta.toFixed(1),
    //  //a: eventData.alpha.toFixed(1),
    //});
  };

  if (!window.DeviceOrientationEvent) {
    alert("Your device/browser does not support device orientation. Sorry");
    return;
  }

  window.addEventListener('deviceorientation', gatherDeviceOrientation, false);

  $("buttons").addEventListener('mousemove', function(e) {
    var position = Input.getRelativeCoordinates(e.target, e);
    g_client.sendCmd('o', { x: Math.floor(position.x / e.target.clientWidth * 2000 - 1000), });
    e.preventDefault();
  });
});


