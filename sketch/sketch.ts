// @ts-ignore
// p5.disableFriendlyErrors = true; // disables FES

let sunImage: p5.Image;
let moonImage: p5.Image;
let earthImage: p5.Image;

let sunTrailColor: p5.Color;
let earthTrailColor: p5.Color;
let moonTrailColor: p5.Color;

// Globals
let bodies: PointMass[];
let savedPrevPos: PointMass[] = [];
let selectedBody: number;
let newVelocity: p5.Vector;

// Config vars
let shouldRun: boolean = false;
let showVel: boolean = false;
let showAccel: boolean = false;
let showForces: boolean = false;
let shiftHeld: boolean = false;
let savePrevious: boolean = false;
let showText: boolean = true;
let selectedInitialState: number = 0;
const numInitialStates: number = 6;
const numSkips: number = 1000;

// Physics vars
const G: number = 10;
const fudge: number = 0.01;

// Sliders
let timeSlider: p5.Element;
const timeSliderMax = 400;
const initialTimeSlider = 100;

let accuracySlider: p5.Element;
const accuracySliderMin = 500;
const accuracySliderMax = 5000;
const initialAccuracySlider = 1000;

let massSliders: p5.Element[];

class PointMass {
  color: p5.Color;
  alphaColor: p5.Color;
  mass: number;
  position: p5.Vector;
  velocity: p5.Vector;
  accel: p5.Vector;
  image: p5.Image;
  rotation: number;
  skips: number;
  tint: null | p5.Color;
  radiusScaling: number;
  prev_positions: p5.Vector[];

  constructor(
    c: p5.Color,
    image: p5.Image,
    mass: number,
    position: p5.Vector,
    velocity: p5.Vector = createVector(0, 0),
    accel: p5.Vector = createVector(0, 0),
    tint: null | p5.Color = null,
    radiusScaling: number = 1.0
  ) {
    this.image = image;
    this.mass = mass;
    this.position = position;
    this.velocity = velocity;
    this.accel = accel;
    this.prev_positions = [];
    this.rotation = 0;
    this.skips = 0;
    // @ts-ignore
    this.color = color(c.levels);
    // @ts-ignore
    this.alphaColor = color(c.levels);
    this.alphaColor.setAlpha(10);
    this.tint = tint;
    this.radiusScaling = radiusScaling;
  }

  accelFrom(other: PointMass): p5.Vector {
    const scaling = 1 / 10;
    const dist = p5.Vector.mult(
      p5.Vector.sub(other.position, this.position),
      scaling
    );
    const invDist = (dist.x ** 2 + dist.y ** 2 + fudge ** 2) ** -1;
    const mag = G * other.mass * invDist;
    const normalizedDist = dist.copy().normalize();
    return normalizedDist.mult(mag);
  }

  applyPhysics(bodies: PointMass[], deltaTime: number) {
    // Update vel
    this.velocity.add(p5.Vector.mult(this.accel, deltaTime / 2));

    const practicalSkips =
      (numSkips * (accuracySlider.value() as number)) / initialAccuracySlider;

    // Update pos
    if (this.skips % practicalSkips == 0) {
      this.rotation += 0.1;
      this.prev_positions.push(this.position.copy());
    }
    this.skips = (this.skips + 1) % practicalSkips;

    this.position.add(p5.Vector.mult(this.velocity, deltaTime));

    this.accel = createVector(0, 0);
    bodies.forEach((body) => {
      if (body != this) {
        const new_accel = this.accelFrom(body);
        this.accel.add(new_accel);
      }
    });

    // Update vel
    this.velocity.add(p5.Vector.mult(this.accel, deltaTime / 2));
  }

  radius(): number {
    return this.mass * 50 * this.radiusScaling;
  }

  overlaps(x: number, y: number): boolean {
    const mouseVec = createVector(x, y);
    const deltaPos = this.position.dist(mouseVec);
    return deltaPos < this.radius();
  }

  renderTrails(): void {
    push();
    // Draw the path until now
    noFill();
    stroke(this.color);
    beginShape();
    this.prev_positions.forEach((pos) => vertex(pos.x, pos.y));
    endShape();

    // Draw the velocity
    if (showVel) {
      const normalizedVel = this.velocity.copy().normalize();
      const scalingFactor = Math.min(
        Math.max(this.velocity.mag() * 75, 50),
        100
      );
      line(
        this.position.x,
        this.position.y,
        this.position.x + this.velocity.x * 100,
        this.position.y + this.velocity.y * 100
      );
    }

    if (showAccel) {
      // Draw the acceleration as well
      // @ts-ignore
      drawingContext.setLineDash([5, 5]);
      const normalizedAcc = this.accel.copy().normalize();
      const scalingFactor = Math.min(
        Math.max(this.accel.mag() * 1000, 40),
        100
      );
      line(
        this.position.x,
        this.position.y,
        this.position.x + normalizedAcc.x * scalingFactor,
        this.position.y + normalizedAcc.y * scalingFactor
      );
    }

    if (showForces) {
      // Draw the acceleration as well
      // @ts-ignore
      drawingContext.setLineDash([5, 5]);

      bodies.forEach((body) => {
        let f = this.accelFrom(body);
        f.normalize();
        const scalingFactor = Math.min(Math.max(f.mag() * 1000, 40), 100);
        line(
          this.position.x,
          this.position.y,
          this.position.x + f.x * scalingFactor,
          this.position.y + f.y * scalingFactor
        );
      });
    }
    pop();
  }

  renderGlow(): void {
    push();
    fill(this.alphaColor);
    // Draw some glow
    for (let i = 0; i < this.radius(); i++) {
      circle(this.position.x, this.position.y, i * 1.5);
    }
    pop();
  }

  render(): void {
    push();
    fill(this.color);
    // Draw the image
    const imageSize = this.radius();
    angleMode(DEGREES);
    translate(this.position.x, this.position.y);
    rotate(this.rotation);
    if (this.tint != null) {
      tint(this.tint);
    }
    image(this.image, -imageSize / 2, -imageSize / 2, imageSize, imageSize);

    pop();
  }
}

function reset() {
  // Two body 1
  if (selectedInitialState == 0) {
    const masses = 1;
    bodies = [
      new PointMass(
        sunTrailColor,
        sunImage,
        masses,
        createVector(width / 2 + 100, height / 2),
        createVector(-0.2, 0.6)
      ),
      new PointMass(
        earthTrailColor,
        earthImage,
        masses,
        createVector(width / 2 - 100, height / 2),
        createVector(0.2, -0.6)
      ),
    ];
  } else if (selectedInitialState == 1) {
    // Two body 2
    bodies = [
      new PointMass(
        sunTrailColor,
        sunImage,
        1,
        createVector(width / 2 + 100, height / 2),
        createVector(0, 1)
      ),
      new PointMass(
        earthTrailColor,
        earthImage,
        1,
        createVector(width / 2 - 100, height / 2),
        createVector(0, -1)
      ),
    ];
  } else if (selectedInitialState == 2) {
    const masses = 1.0;
    const r = 100;
    const v = 1.0;
    angleMode(DEGREES);
    bodies = [
      new PointMass(
        sunTrailColor,
        sunImage,
        masses,
        createVector(width / 2, height / 2 + r),
        createVector(v, 0)
      ),
      new PointMass(
        earthTrailColor,
        earthImage,
        masses,
        createVector(width / 2 + sin(60) * r, height / 2 - cos(60) * r),
        createVector(-cos(60) * v, -sin(60) * v)
      ),
      new PointMass(
        moonTrailColor,
        moonImage,
        masses,
        createVector(width / 2 - sin(60) * r, height / 2 - cos(60) * r),
        createVector(-cos(60) * v, sin(60) * v)
      ),
    ];
  } else if (selectedInitialState == 3) {
    // Three body 2
    const f8Pos = createVector(0.97000436 * 300, -0.24308753 * 300);
    const f8Vel = createVector(-0.93240737, 0.86473146);
    const masses = 1;
    bodies = [
      new PointMass(
        sunTrailColor,
        sunImage,
        masses,
        createVector(width / 2, height / 2),
        f8Vel
      ),
      new PointMass(
        earthTrailColor,
        earthImage,
        masses,
        createVector(width / 2 + f8Pos.x, height / 2 - f8Pos.y),
        p5.Vector.div(f8Vel, -2)
      ),
      new PointMass(
        moonTrailColor,
        moonImage,
        masses,
        createVector(width / 2 - f8Pos.x, height / 2 + f8Pos.y),
        p5.Vector.div(f8Vel, -2)
      ),
    ];
  } else if (selectedInitialState == 4) {
    // Three body 2
    const f8Pos = createVector(0.97000436 * 300, -0.24308753 * 300);
    const f8Vel = createVector(-0.93240737 / 2, 0.86473146 / 2);
    const masses = 1;
    bodies = [
      new PointMass(
        sunTrailColor,
        sunImage,
        masses,
        createVector(width / 2, height / 2),
        f8Vel
      ),
      new PointMass(
        earthTrailColor,
        earthImage,
        masses,
        createVector(width / 2 + f8Pos.x, height / 2 - f8Pos.y),
        p5.Vector.mult(f8Vel, -1)
      ),
    ];
  } else if (selectedInitialState == 5) {
    // Three body 2
    const f8Pos = createVector(0.97000436 * 300, -0.24308753 * 300);
    const f8Vel = createVector(-0.93240737, 0.86473146);
    const masses = 0.3;
    bodies = [
      new PointMass(
        sunTrailColor,
        sunImage,
        masses,
        createVector(width / 2, height / 2),
        f8Vel,
        createVector(0, 0),
        null,
        3
      ),
      new PointMass(
        earthTrailColor,
        earthImage,
        masses,
        createVector(width / 2 + f8Pos.x, height / 2 - f8Pos.y),
        p5.Vector.div(f8Vel, -2),
        createVector(0, 0),
        null,
        3
      ),
      new PointMass(
        moonTrailColor,
        moonImage,
        masses,
        createVector(width / 2 - f8Pos.x, height / 2 + f8Pos.y),
        p5.Vector.div(f8Vel, -2),
        createVector(0, 0),
        null,
        3
      ),
    ];
  }
}

function setup() {
  console.log("🚀 - Setup initialized - P5 is running");

  frameRate(240);
  createCanvas(windowWidth, windowHeight);

  timeSlider = createSlider(1, timeSliderMax, initialTimeSlider, 0);
  timeSlider.position(10, windowHeight - windowHeight / 10);
  timeSlider.style("width", "100px");

  accuracySlider = createSlider(
    accuracySliderMin,
    accuracySliderMax,
    initialAccuracySlider,
    0
  );
  accuracySlider.position(10, windowHeight - windowHeight / 6);
  accuracySlider.style("width", "100px");

  textFont("Roboto");
  textSize(16);

  reset();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(10);

  // Print instructions
  if (showText) {
    push();
    fill(255);
    stroke(255);
    text(
      "Instructions:\nP to pause/unpause\nRight arrow to run a single step of the sim\nR to reset sim to original state\nA to show acceleration vectors\nV to show velocity vectors\nF to show force vectors\nS to save trails from previous run\nC to clear trails\n+ to move forward through predefined states\n- to move backward through predefined states\nShift + click to create new planet\nClick + drag on planet to adjust velocity vector\nH to hide this text",
      10,
      10,
      windowWidth / 4,
      windowHeight
    );
    pop();
  }

  // Print always showing text
  push();
  let fps = frameRate();
  fill(255);
  stroke(255);
  text("FPS: " + fps.toFixed(2), 10, height - 10);
  text("Simulation speed", 10, windowHeight - windowHeight / 10 - 10);

  text("Simulation accuracy", 10, windowHeight - windowHeight / 6 - 10);
  pop();

  // Draw the planets
  bodies.forEach((body) => {
    body.renderGlow();
  });

  bodies.forEach((body) => {
    body.renderTrails();
  });

  bodies.forEach((body) => {
    body.render();
  });

  savedPrevPos.forEach((prev) => {
    // Draw the path until now
    push();
    prev.color.setAlpha(90);
    stroke(prev.color);
    noFill();
    beginShape();
    prev.prev_positions.forEach((pos) => vertex(pos.x, pos.y));
    endShape();
    pop();
  });

  if (shouldRun) {
    runStep();
  }

  if (newVelocity != null) {
    push();
    stroke(bodies[selectedBody].color);
    line(
      bodies[selectedBody].position.x,
      bodies[selectedBody].position.y,
      bodies[selectedBody].position.x + newVelocity.x,
      bodies[selectedBody].position.y + newVelocity.y
    );
    pop();
  }
}

function runStep() {
  const deltaTime =
    10 *
    (timeSlider.value() as number) *
    ((accuracySlider.value() as number) / initialAccuracySlider);
  const accuracy = 1 / (accuracySlider.value() as number);
  for (let i = 0; i < deltaTime; i++) {
    bodies.forEach((body) => body.applyPhysics(bodies, accuracy));
  }
}

function mousePressed() {
  if (shiftHeld) {
    const c = color(random(255), random(255), random(255));
    bodies.push(
      new PointMass(
        c,
        moonImage,
        1,
        createVector(mouseX, mouseY),
        createVector(0, 0),
        createVector(0, 0),
        c
      )
    );
  } else {
    bodies.forEach((body) => {
      if (body.overlaps(mouseX, mouseY)) {
        selectedBody = bodies.indexOf(body);
      }
    });
  }
}

function mouseDragged() {
  if (selectedBody != null) {
    const mouseVec = createVector(mouseX, mouseY);
    newVelocity = p5.Vector.sub(mouseVec, bodies[selectedBody].position);
  }
}

function mouseReleased() {
  if (selectedBody != null) {
    if (newVelocity != null) {
      bodies[selectedBody].velocity = p5.Vector.div(newVelocity, 100);
    }
    selectedBody = null;
    newVelocity = null;
  }
}

function keyPressed() {
  if (keyCode === RIGHT_ARROW) {
    runStep();
  } else if (keyCode === SHIFT) {
    shiftHeld = true;
  } else if (keyCode === 187) {
    selectedInitialState = (selectedInitialState + 1) % numInitialStates;
    reset();
  } else if (keyCode === 189) {
    selectedInitialState =
      selectedInitialState === 0
        ? numInitialStates - 1
        : selectedInitialState - 1;
    reset();
  }

  if (key === "p") {
    // Pause
    shouldRun = !shouldRun;
  } else if (key === "r") {
    // Reset
    if (savePrevious) {
      savedPrevPos = bodies;
    }
    reset();
  } else if (key === "a") {
    showAccel = !showAccel;
  } else if (key === "v") {
    showVel = !showVel;
  } else if (key === "s") {
    savePrevious = !savePrevious;
  } else if (key === "f") {
    showForces = !showForces;
  } else if (key === "c") {
    bodies.forEach((body) => {
      body.prev_positions = [];
    });
  } else if (key === "h") {
    showText = !showText;
  }
}

function keyReleased() {
  if (keyCode === SHIFT) {
    shiftHeld = false;
  }
}

function preload() {
  sunTrailColor = color(240, 150, 55);
  earthTrailColor = color(137, 227, 228);
  moonTrailColor = color(238, 252, 252);
  sunImage = loadImage("images/sun.png");
  moonImage = loadImage("images/moon.png");
  earthImage = loadImage("images/earth.png");
}
