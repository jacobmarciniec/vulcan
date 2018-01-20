/* Vulcan
 * TODO: account for potential update lag in calculations
 * TODO: account for computation time in calculations
 * TODO: account for special relativety in calculations
 *
 * Positions are expressed as arrays like so:
 * [
 *     <position on x axis (in meters from left side of canvas)>,
 *     <position on y axis (in meters from bottom of canvas)>
 * ]
 *
 * Velocities are expressed as arrays like so:
 * [
 *     <speed along x axis (in m/s)>,
 *     <speed along y axis (in m/s)>
 * ]
 *
 * Acceleration are expressed as arrays like so:
 * [
 *     <acceleration along x axis (in m/s^2)>,
 *     <acceleration along y axis (in m/s^2)>
 * ]
 *
 */


// the number of pixels that equal 1 meter
const SCALE                      = 10;

// at what framerate rockets should be blocked from spawning
const FRAMERATE_TOLERANCE        = 15;

const ACCELERAION_DUE_TO_GRAVITY = -9.80665 /*  m/s^2 */;
const AIR_DENSITY                =  1.29 /* kg/m^3 */;

/* we assume that comets are spheres, and have an equal cross sectional area in
 * all directions */
const COMET_AREA                 =  0.0001 /* m^2 */;
const COMET_MASS                 =  0.05 /* kg */;
const COMET_DRAG_COEFFICIENT     =  0.7;
const COMET_WEIGHT               = COMET_MASS * ACCELERAION_DUE_TO_GRAVITY;
const ROCKET_ACCELERATION        =  26;
const MINMUM_COMET_COUNT         =  25;
const MAXIMUM_COMET_COUNT        =  75;
const MINMUM_COMET_ACCELERATION  = 100;
const MAXIMUM_COMET_ACCELERATION = 150;


var canvas        = document.querySelector("canvas");
var canvasContext = canvas.getContext("2d");


// active and/or queued rockets and comets
var rockets = [];
var comets  = [];

// for keeping track of the framerate
var mostRecentRepaint;
var framerate;

/**
 */
function getRandomInt(min, max) {
    return Math.random() * (max - min) + min;
}


/**
 */
function pixelsToMeters(pixels) {
    return pixels / SCALE;
}


/**
 */
function millisecondsToSeconds(ms) {
    return ms * 1000;
}


/**
 */
function getArbitraryTime() {
    return millisecondsToSeconds(performance.now());
}


/**
 */
function calculateDisplacement(initialVelocity, time, acceleration) {
    return (initialVelocity * time) + ((Math.pow(time, 2) * acceleration) / 2);
}


/**
 */
function calculateVelocity(displacement, time) {
    return displacement / time;
}


/**
 */
function calculateAcceleration(initialVelocity, finalVelocity, time) {
    return (finalVelocity - initialVelocity) / time;
}


/**
 */
function Rocket(initalPosition, target) {
    this.spawned          = false;
    this.detonated        = false;

    this.initalPosition   = initalPosition || this.getRandomInitialPosition();
    this.initalVelocity   = [0, 0];
    this.target           = target || this.getRandomTarget();
    this.acceration       = ROCKET_ACCELERATION;

    this.currentPosition  = [undefined, undefined];
    this.currentVelocity  = [];
    this.currentAcceleration;
    this.recentPositions  = [];
    this.lastUpdate       = null;

    this.color            = this.getRandomColor();
}


/**
 */
Rocket.update = function() {
    if (!this.lastUpdate) {
        this.lastUpdate = getArbitraryTime();
        return;
    }

    let lastPosition     = this.currentPosition;
    let lastVelocity     = this.currentVelocity;
    let lastAcceleration = this.currentAcceleration;

    let timeNow   = getArbitraryTime();
    let timeDelta = timeNow - this.lastUpdate;

    let deltaXPosition =
        calculateDisplacement(lastVelocity[0], timeDelta, lastAcceleration[0]);

    let deltaYPosition =
        calculateDisplacement(lastVelocity[1], timeDelta, lastAcceleration[1]);

    this.currentPosition = [
        (lastPosition[0] + deltaXPosition),
        (lastPosition[1] + deltaYPosition)
    ];

    this.currentVelocity = [
        calculateVelocity(deltaXPosition, timeDelta),
        calculateVelocity(deltaYPosition, timeDelta)
    ];

    this.currentAcceleration = [
        calculateAcceleration(lastVelocity[0], this.currentVelocity[1], timeDelta),
        calculateAcceleration(lastVelocity[0], this.currentVelocity[1], timeDelta) + ACCELERAION_DUE_TO_GRAVITY
    ];

    this.lastUpdate = timeNow;
    return;
};


/**
 */
Rocket.draw = function() {

};


/**
 */
Rocket.getInitialDirection = function() {

};


/**
 */
Rocket.getRandomColor = function getRandomColor() {

};


/**
*/
Rocket.getRandomInitialPosition = function() {
    return [getRandomInt(0, canvas.offsetWidth), 0];
};


/**
 */
Rocket.spawn = function() {
    this.spawned = true;
    rockets.push(this);
};


/**
 */
Rocket.detonate = function() {
    this.detonated = true;
    let cometCount = getRandomInt(MINMUM_COMET_COUNT, MAXIMUM_COMET_COUNT);
    for (var i = 0; i < cometCount; i++) {
        comets.push(new Comet());
    }
};

Rocket.prototype.constructor = Rocket;


/**
 */
function Comet() {
    this.spawned          = false;
    this.decayed          = false;

    this.initialPosition  = this.finalPosition;

    /* Although it is not physically accurate to give a comet an inital
     * velocity (as though it spontaneously recieved it) it will be given one,
     * since its acceleration due to the detonation of its rocket would be so
     * large, and only exist for such a short period of time that it is
     * accurate to assume so for the purposes of this project. */
    this.initalVelocity   = [
        getRandomInt(100, 300) + this.currentVelocity[0],
        getRandomInt(100, 300) + this.currentVelocity[1]
    ];

    // How long until the comet burns out
    this.duration         = getRandomInt(0,1);

    this.dragCoefficient  = COMET_DRAG_COEFFICIENT;
    this.currentPosition  = [null, null];
 // this.color inherited from parent (Rocket)
}

Comet.spawned = function() {
    this.spawned = getArbitraryTime();
};

Comet.update = function() {

};

Comet.draw = function() {

};

Comet.prototype = Object.create(Rocket.prototype);
Comet.prototype.constructor = Comet;


/**
 */
function fanfare() {
    // spawn 8 random rockets a second for 4 seconds
}


/**
 */
function gameLoop() {
    // keep track of framerate
    if (!mostRecentRepaint) {
        mostRecentRepaint = getArbitraryTime();
    } else {

        // get the amount of time that has passed since the last repaint
        let change = mostRecentRepaint - getArbitraryTime();

        // calculate frames per second
        framerate = 1 / change;

    }

    mostRecentRepaint = getArbitraryTime();

    // keep track of time

    // spawn a rocket every 3 seconds unless...

    // 1. the user clicks (then spawn a rocket to their click)

    // 2. a fanfare is in progress

    // Update rockets and comets, throttling the spawning of new rockets if the
    // framerate is below the configured tolerance
    for (let i = 0; i < rockets.length; i++) {
        let rocket = rockets[i];

        if (rocket.detonated) {
            rockets.splice(i, 1);
            continue;
        }

        if ((framerate > FRAMERATE_TOLERANCE) || rocket.spawned) {
            rocket.update();
            rocket.draw();
        }

        continue;
    }

    for (let i = 0; i < comets.length; i++) {
        let comet = comets[i];

        if (comet.decayed) {
            comets.splice(i, 1);
            continue;
        }

        continue;
    }
}


canvas.addEventListener("click", (/* event */) => {
    // spawn firework with target at click position
    // [event.clientX, event.clientY]
});


let form = document.querySelector("form");

form.addEventListener("submit", (/* event */) => {
    fanfare();
});


/* MDN resize event optimization
 * -----------------------------
 * Shamelessly copied from developer.mozilla.org on 2017 November 30
 * https://developer.mozilla.org/en-US/docs/Web/Events/resize
 * ------------------------------------------------------------------------- */
var optimizedResize = (function() {

    var callbacks = [],
        running = false;

    // fired on resize event
    function resize() {
        if (!running) {
            running = true;

            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(runCallbacks);
            } else {
                setTimeout(runCallbacks, 66);
            }
        }
    }

    // run the actual callbacks
    function runCallbacks() {
        callbacks.forEach(function(callback) {
            callback();
        });

        running = false;
    }

    // adds callback to loop
    function addCallback(callback) {
        if (callback) {
            callbacks.push(callback);
        }
    }

    return {
        // public method to add additional callback
        add: function(callback) {
            if (!callbacks.length) {
                window.addEventListener("resize", resize);
            }
            addCallback(callback);
        }
    };
}());

/**
 */
function resizeCanvas() {
    canvas.style.width  = "100%";
    canvas.style.height = "100%";
    canvas.width        = canvas.offsetWidth;
    canvas.height       = canvas.offsetHeight;
}


window.addEventListener("load", gameLoop);
window.addEventListener("load", resizeCanvas);
optimizedResize.add(resizeCanvas);
