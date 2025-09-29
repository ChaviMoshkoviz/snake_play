const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreDisplay = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');

// רכיבי מסך הגדרות
const settingsScreen = document.getElementById('settingsScreen');
const obstacleCountInput = document.getElementById('obstacleCount');
const startButton = document.getElementById('startButton');

// רכיבי כפתורי מהירות
const speedUpButton = document.getElementById('speedUp');
const speedDownButton = document.getElementById('speedDown');
const currentSpeedDisplay = document.getElementById('currentSpeedDisplay');

// רכיבי אודיו
const backgroundMusic = document.getElementById('backgroundMusic');
const explosionSound = document.getElementById('explosionSound');
let musicPlayed = false;

// גודל קבוע של ריבוע ברשת - זה הבסיס ליחידות המידה
const baseGridSize = 20; 
const headSizeFactor = 1.2;
const headGridSize = baseGridSize * headSizeFactor; // לא בשימוש ישיר לציור, רק קבוע יחס
const headOffset = (headGridSize - baseGridSize) / 2; // לא בשימוש ישיר לציור

// --- הגדרות משחק ---
let gameSpeed = 300; 
const MIN_GAME_SPEED = 50; 
const MAX_GAME_SPEED = 350; 
const SPEED_STEP = 25; 
let numberOfObstacles = 3; 
const MIN_OBSTACLES = 0; 
const MAX_OBSTACLES = 10; 
let allowWallPassage = true; 
// --------------------

let snake = [{ x: 10, y: 10, color: 'green' }];
let food = {};
let obstacles = [];
let direction = { x: 0, y: 0 };
let score = 0;
let gameOver = false;
let gameInterval;

const colors = ['red', 'blue', 'purple', 'orange', 'cyan', 'magenta', 'yellow', 'lime'];
let currentFoodColor;

let mouthOpenFactor = 0;
let mouthAnimationDirection = 1;
const mouthAnimationSpeedFactor = 0.15;

let explosionParticles = [];
const numExplosionParticles = 100;
const explosionAnimationDuration = 500;
const scoreDisplayDelayAfterExplosion = 1500;

let animationFrameId;

function changeObstacleCount(increase) {
    let currentCount = parseInt(obstacleCountInput.value);
    if (isNaN(currentCount)) {
        currentCount = numberOfObstacles;
    }

    if (increase) {
        if (currentCount < MAX_OBSTACLES) {
            currentCount++;
        }
    } else {
        if (currentCount > MIN_OBSTACLES) {
            currentCount--;
        }
    }
    obstacleCountInput.value = currentCount;
    numberOfObstacles = currentCount;
}

function resizeCanvas() {
    const wrapper = document.querySelector('.game-wrapper');
    if (wrapper && wrapper.offsetParent !== null) { 
        // ודא שהקנבס ממלא את ההורה שלו
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        // חשוב: צייר מחדש את הלוח לאחר שינוי גודל הקנבס
        if (!gameOver && !settingsScreen.classList.contains('hidden')) {
            // אם המשחק לא נגמר ואנחנו לא במסך הגדרות, צייר את המשחק מחדש
            draw();
        } else if (settingsScreen.classList.contains('hidden') && !gameOver) {
            // אם אנחנו במשחק פעיל ושינינו גודל, נצייר מחדש את הכל
            // generateFood() ו-generateObstacles() יקרה ב-initializeGame, 
            // אז רק נצייר את מה שקיים
            draw();
        }
    }
}

window.addEventListener('resize', resizeCanvas);


function updateSpeedDisplay() {
    const speedRange = MAX_GAME_SPEED - MIN_GAME_SPEED;
    const currentRelativeSpeed = gameSpeed - MIN_GAME_SPEED;
    const displayValue = Math.round((speedRange - currentRelativeSpeed) / SPEED_STEP) + 1;
    currentSpeedDisplay.textContent = displayValue;
}

function changeGameSpeed(increase) {
    activateMusic();
    if (gameOver) return;

    if (increase) {
        if (gameSpeed > MIN_GAME_SPEED) {
            gameSpeed -= SPEED_STEP;
        }
    } else {
        if (gameSpeed < MAX_GAME_SPEED) {
            gameSpeed += SPEED_STEP;
        }
    }
    clearInterval(gameInterval);
    gameInterval = setInterval(updateGame, gameSpeed);
    updateSpeedDisplay();
}

// פונקציית עזר לחישוב גודל תא הרשת בפועל
// מבוסס על הרוחב הקבוע של 20 תאים
function getCurrentGridSize() {
    // נניח ש-baseGridSize הוא 20. אם רוחב הקנבס 400, אז 400/20 = 20.
    // אם רוחב הקנבס 600, אז 600/20 = 30.
    // כלומר, גודל התא משתנה כדי להתאים לרוחב הקנבס תוך שמירה על יחס קבוע של מספר תאים.
    return canvas.width / (canvas.width / baseGridSize); // זה פשוט מחזיר baseGridSize
}
// תיקון: אם אנחנו רוצים שגודל התא יתאים את עצמו לגודל הקנבס
// תוך שמירה על *מספר קבוע של תאים*, החישוב הנכון יותר הוא:
function getResponsiveGridSize() {
    const desiredCellsX = canvas.width / baseGridSize; // לדוגמה, כמה תאים יש ב-gridSize 20 ברוחב הקנבס הנוכחי
    const desiredCellsY = canvas.height / baseGridSize;
    // נבחר את הקטן מבין השניים כדי למנוע חריגה מהלוח
    return Math.min(canvas.width / Math.floor(canvas.width / baseGridSize), canvas.height / Math.floor(canvas.height / baseGridSize));
}

// פונקציה לעדכון מיקום האוכל (צריך להיות בטווחים של תאי הרשת החדשים)
function generateFood() {
    const responsiveGridSize = getResponsiveGridSize();
    const cols = Math.floor(canvas.width / responsiveGridSize);
    const rows = Math.floor(canvas.height / responsiveGridSize);

    food = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
    };
    currentFoodColor = colors[Math.floor(Math.random() * colors.length)];

    // ודא שהאוכל לא נוצר על הנחש או על מכשול
    if (checkCollision(food, snake) || checkCollision(food, obstacles)) {
        generateFood();
    }
}

// פונקציה לעדכון מיקום המכשולים (צריך להיות בטווחים של תאי הרשת החדשים)
function generateObstacles(count) {
    obstacles = [];
    const minObstacleSize = 2;
    const maxObstacleSize = 4;
    const responsiveGridSize = getResponsiveGridSize();
    const cols = Math.floor(canvas.width / responsiveGridSize);
    const rows = Math.floor(canvas.height / responsiveGridSize);

    for (let i = 0; i < count; i++) {
        let size = Math.floor(Math.random() * (maxObstacleSize - minObstacleSize + 1)) + minObstacleSize;
        // ודא שהמכשולים נוצרים בתוך גבולות הלוח
        let obsX = Math.floor(Math.random() * (cols - size + 1));
        let obsY = Math.floor(Math.random() * (rows - size + 1));

        let newObstacle = [];
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                newObstacle.push({ x: obsX + dx, y: obsY + dy });
            }
        }
        
        let collisionDetected = false;
        // ודא שהמכשול לא נוצר על הנחש או על אוכל
        for (const segment of newObstacle) {
            if (checkCollision(segment, snake) || checkCollision(segment, [food])) {
                collisionDetected = true;
                break;
            }
        }
        // ודא שהמכשול לא חופף למכשולים קיימים
        if (!collisionDetected) {
            for (const existingObsBlock of obstacles) {
                for (const existingSegment of existingObsBlock) {
                    if (checkCollision(existingSegment, newObstacle)) {
                        collisionDetected = true;
                        break;
                    }
                }
                if (collisionDetected) break;
            }
        }

        if (collisionDetected) {
            i--; // נסה ליצור מכשול חדש אם הייתה התנגשות
        } else {
            obstacles.push(newObstacle);
        }
    }
}

function checkCollision(obj, arr) {
    for (let i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i])) { // אם זה בלוק מכשול
            for (let j = 0; j < arr[i].length; j++) {
                if (obj.x === arr[i][j].x && obj.y === arr[i][j].y) {
                    return true;
                }
            }
        } else { // אם זה אובייקט בודד (לדוגמה, האוכל)
            if (obj.x === arr[i].x && obj.y === arr[i].y) {
                return true;
            }
        }
    }
    return false;
}

// פונקציה ראשית לציור הכל
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // נקה את כל הקנבס
    drawFood();
    drawObstacles(); 
    drawSnake();
}

function drawSnake() {
    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם
    drawSnakeHead(snake[0], mouthOpenFactor, responsiveGridSize);
    for (let i = 1; i < snake.length - 1; i++) {
        ctx.fillStyle = snake[i].color;
        ctx.fillRect(snake[i].x * responsiveGridSize, snake[i].y * responsiveGridSize, responsiveGridSize, responsiveGridSize);
    }
    if (snake.length > 1) {
        drawSnakeTail(snake[snake.length - 1], snake[snake.length - 2], responsiveGridSize);
    }
}

function drawSnakeHead(head, mouthOpenFactor, responsiveGridSize) {
    // חישובים מבוססים על responsiveGridSize
    const currentHeadSize = responsiveGridSize * headSizeFactor;
    const currentHeadOffset = (currentHeadSize - responsiveGridSize) / 2;

    const headX = head.x * responsiveGridSize - currentHeadOffset;
    const headY = head.y * responsiveGridSize - currentHeadOffset;
    const halfHeadSize = currentHeadSize / 2;

    ctx.fillStyle = head.color;
    ctx.beginPath();
    ctx.roundRect(headX, headY, currentHeadSize, currentHeadSize, 5);
    ctx.fill();

    ctx.fillStyle = 'black';
    const eyeSize = currentHeadSize / 8;
    const eyeOffset = currentHeadSize / 4;
    ctx.beginPath();
    ctx.arc(headX + eyeOffset, headY + eyeOffset, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX + currentHeadSize - eyeOffset, headY + eyeOffset, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    const mouthWidth = currentHeadSize * 0.4;
    const mouthMaxHeight = currentHeadSize * 0.35;
    const mouthCurrentHeight = mouthMaxHeight * mouthOpenFactor;
    const mouthY = headY + currentHeadSize - (currentHeadSize / 3);

    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.arc(headX + halfHeadSize, mouthY, mouthWidth / 2, 0, Math.PI, false);
    ctx.lineTo(headX + halfHeadSize + mouthWidth / 2, mouthY + mouthCurrentHeight);
    ctx.arc(headX + halfHeadSize, mouthY + mouthCurrentHeight, mouthWidth / 2, 0, Math.PI, true);
    ctx.lineTo(headX + halfHeadSize - mouthWidth / 2, mouthY + mouthCurrentHeight);
    ctx.fill();

    if (mouthOpenFactor > 0.1) {
        ctx.fillStyle = 'white';
        const toothWidth = currentHeadSize / 10;
        const toothHeight = currentHeadSize / 4;
        const toothSpacing = currentHeadSize / 4.5;

        ctx.beginPath();
        ctx.moveTo(headX + halfHeadSize - toothSpacing, mouthY);
        ctx.lineTo(headX + halfHeadSize - toothSpacing - toothWidth / 2, mouthY - toothHeight);
        ctx.lineTo(headX + halfHeadSize - toothSpacing + toothWidth / 2, mouthY);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(headX + halfHeadSize + toothSpacing, mouthY);
        ctx.lineTo(headX + halfHeadSize + toothSpacing - toothWidth / 2, mouthY - toothHeight);
        ctx.lineTo(headX + halfHeadSize + toothSpacing + toothWidth / 2, mouthY);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(headX + halfHeadSize - toothSpacing, mouthY + mouthCurrentHeight);
        ctx.lineTo(headX + halfHeadSize - toothSpacing - toothWidth / 2, mouthY + mouthCurrentHeight + toothHeight);
        ctx.lineTo(headX + halfHeadSize - toothSpacing + toothWidth / 2, mouthY + mouthCurrentHeight);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(headX + halfHeadSize + toothSpacing, mouthY + mouthCurrentHeight);
        ctx.lineTo(headX + halfHeadSize + toothSpacing - toothWidth / 2, mouthY + mouthCurrentHeight + toothHeight);
        ctx.lineTo(headX + halfHeadSize + toothSpacing + toothWidth / 2, mouthY + mouthCurrentHeight);
        ctx.fill();
    }
}

function drawSnakeTail(tail, prevSegment, responsiveGridSize) {
    ctx.fillStyle = tail.color;
    const tailX = tail.x * responsiveGridSize;
    const tailY = tail.y * responsiveGridSize;
    const halfGrid = responsiveGridSize / 2;

    ctx.beginPath();
    if (tail.x < prevSegment.x) {
        ctx.moveTo(tailX, tailY + halfGrid);
        ctx.lineTo(tailX + responsiveGridSize, tailY);
        ctx.lineTo(tailX + responsiveGridSize, tailY + responsiveGridSize);
    } else if (tail.x > prevSegment.x) {
        ctx.moveTo(tailX + responsiveGridSize, tailY + halfGrid);
        ctx.lineTo(tailX, tailY);
        ctx.lineTo(tailX, tailY + responsiveGridSize);
    } else if (tail.y < prevSegment.y) {
        ctx.moveTo(tailX + halfGrid, tailY);
        ctx.lineTo(tailX, tailY + responsiveGridSize);
        ctx.lineTo(tailX + responsiveGridSize, tailY + responsiveGridSize);
    } else {
        ctx.moveTo(tailX + halfGrid, tailY + responsiveGridSize);
        ctx.lineTo(tailX, tailY);
        ctx.lineTo(tailX + responsiveGridSize, tailY);
    }
    ctx.fill();
}

function drawFood() {
    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם
    ctx.fillStyle = currentFoodColor;
    ctx.beginPath();
    ctx.arc((food.x * responsiveGridSize) + (responsiveGridSize / 2), (food.y * responsiveGridSize) + (responsiveGridSize / 2), responsiveGridSize / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawObstacles() {
    if (obstacles.length === 0) return; 
    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם

    obstacles.forEach(obsBlock => {
        obsBlock.forEach(segment => {
            const x = segment.x * responsiveGridSize;
            const y = segment.y * responsiveGridSize;

            ctx.fillStyle = '#6c5b4e';
            ctx.strokeStyle = '#4a3b30';
            ctx.lineWidth = 1; // קו קבוע, לא תלוי בגודל התא, אפשר לשנות אם רוצים

            ctx.beginPath();
            ctx.arc(x + responsiveGridSize * 0.5, y + responsiveGridSize * 0.5, responsiveGridSize * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(x + Math.random() * responsiveGridSize, y + Math.random() * responsiveGridSize, responsiveGridSize * 0.1, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    });
}

function createExplosionParticles(x, y) {
    explosionParticles = [];
    explosionSound.play();
    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם
    for (let i = 0; i < numExplosionParticles; i++) {
        explosionParticles.push({
            x: x + responsiveGridSize / 2, 
            y: y + responsiveGridSize / 2, 
            radius: Math.random() * 4 + 2, 
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            speedX: (Math.random() - 0.5) * 15, 
            speedY: (Math.random() - 0.5) * 15, 
            alpha: 1,
            life: explosionAnimationDuration
        });
    }
}

function animateExplosion() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allParticlesFaded = true;
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const p = explosionParticles[i];

        p.x += p.speedX;
        p.y += p.speedY;
        p.alpha -= 1 / (explosionAnimationDuration / (1000 / 60));
        p.radius *= 0.95;

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.alpha > 0.05 && p.radius >= 0.5) {
            allParticlesFaded = false;
        } else {
            explosionParticles.splice(i, 1);
        }
    }

    if (!allParticlesFaded || explosionParticles.length > 0) {
        animationFrameId = requestAnimationFrame(animateExplosion);
    } else {
        setTimeout(() => {
            finalScoreDisplay.textContent = score;
            gameOverScreen.style.display = 'flex'; 
        }, scoreDisplayDelayAfterExplosion);
    }
}

function updateGame() {
    if (gameOver) {
        return;
    }

    mouthOpenFactor += mouthAnimationDirection * mouthAnimationSpeedFactor;
    if (mouthOpenFactor >= 1) {
        mouthOpenFactor = 1;
        mouthAnimationDirection = -1;
    } else if (mouthOpenFactor <= 0) {
        mouthOpenFactor = 0;
        mouthAnimationDirection = 1;
    }

    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם

    // חשב את מספר העמודות והשורות בפועל על בסיס גודל הקנבס וגודל התא המותאם
    const gridCols = Math.floor(canvas.width / responsiveGridSize);
    const gridRows = Math.floor(canvas.height / responsiveGridSize);

    let newHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y, color: snake[0].color };
    
    // מעבר קירות
    if (newHead.x < 0) newHead.x = gridCols - 1;
    else if (newHead.x >= gridCols) newHead.x = 0;
    
    if (newHead.y < 0) newHead.y = gridRows - 1;
    else if (newHead.y >= gridRows) newHead.y = 0;
    
    snake.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
        score++;
        scoreDisplay.textContent = score;
        snake[0].color = currentFoodColor;
        generateFood();
        mouthOpenFactor = 1;
        mouthAnimationDirection = -1;
    } else {
        snake.pop();
    }

    for (let i = 2; i < snake.length; i++) {
        if (newHead.x === snake[i].x && newHead.y === snake[i].y) {
            endGame(newHead.x, newHead.y);
            return;
        }
    }

    if (obstacles.length > 0 && checkCollision(newHead, obstacles)) {
        endGame(newHead.x, newHead.y);
        return;
    }

    draw(); // קריאה לפונקציית הציור המרכזית
}

function endGame(gridX, gridY) {
    gameOver = true;
    clearInterval(gameInterval);
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0; 

    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם
    createExplosionParticles(gridX * responsiveGridSize, gridY * responsiveGridSize);
    animationFrameId = requestAnimationFrame(animateExplosion);
}

function activateMusic() {
    if (!musicPlayed) {
        backgroundMusic.play().catch(error => {
            console.log("Autoplay prevented:", error);
        });
        musicPlayed = true;
    }
}

document.addEventListener('keydown', e => {
    activateMusic();

    if (gameOver) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Return') {
            if (gameOverScreen.style.display === 'flex') {
                gameOverScreen.style.display = 'none'; 
                showSettingsScreen();
            }
        }
        return;
    }

    if (!settingsScreen.classList.contains('hidden')) {
        switch (e.key) {
            case '+':
            case '=':
                changeObstacleCount(true);
                break;
            case '-':
                changeObstacleCount(false);
                break;
            case 'Enter': 
            case ' ':
                initializeGame();
                break;
        }
        return;
    }

    switch (e.key) {
        case 'ArrowUp':
            if (direction.y !== 1) direction = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (direction.y !== -1) direction = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (direction.x !== 1) direction = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (direction.x !== -1) direction = { x: 1, y: 0 };
            break;
        case '+':
        case '=':
            changeGameSpeed(true);
            break;
        case '-':
            changeGameSpeed(false);
            break;
    }
});

canvas.addEventListener('mousemove', e => {
    activateMusic();

    if (gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const responsiveGridSize = getResponsiveGridSize(); // קבל את גודל התא המותאם

    // חשב את מיקום ראש הנחש בפיקסלים על בסיס responsiveGridSize
    const headX = snake[0].x * responsiveGridSize + responsiveGridSize / 2;
    const headY = snake[0].y * responsiveGridSize + responsiveGridSize / 2;

    const diffX = mouseX - headX;
    const diffY = mouseY - headY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
            if (direction.x !== -1) direction = { x: 1, y: 0 };
        } else {
            if (direction.x !== 1) direction = { x: -1, y: 0 };
        }
    } else {
        if (diffY > 0) {
            if (direction.y !== -1) direction = { x: 0, y: 1 };
        } else {
            if (direction.y !== 1) direction = { x: 0, y: -1 };
        }
    }
});

function showSettingsScreen() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    clearInterval(gameInterval); 
    
    snake = [{ x: 10, y: 10, color: 'green' }]; // אתחל את מיקום הנחש
    direction = { x: 0, y: 0 };
    score = 0;
    scoreDisplay.textContent = score;
    gameOver = false;
    explosionParticles = [];
    mouthOpenFactor = 0;
    mouthAnimationDirection = 1;
    gameSpeed = 300; 
    updateSpeedDisplay(); 
    
    obstacleCountInput.value = numberOfObstacles;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // נקה את הקנבס
    // אין צורך לצייר כאן, initializeGame יטפל בזה

    gameOverScreen.style.display = 'none'; 

    canvas.style.display = 'none';
    document.querySelector('.score-container').style.display = 'none'; 
    
    settingsScreen.classList.remove('hidden');

    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    musicPlayed = false; 
    
    resizeCanvas(); // קרא ל-resizeCanvas כדי לוודא גודל קנבס נכון
}

function initializeGame() {
    gameOverScreen.style.display = 'none'; 

    numberOfObstacles = parseInt(obstacleCountInput.value, 10);
    if (isNaN(numberOfObstacles) || numberOfObstacles < MIN_OBSTACLES) {
        numberOfObstacles = MIN_OBSTACLES; 
    } else if (numberOfObstacles > MAX_OBSTACLES) {
        numberOfObstacles = MAX_OBSTACLES; 
    }
    obstacleCountInput.value = numberOfObstacles;
    
    allowWallPassage = true; 
    
    settingsScreen.classList.add('hidden');
    canvas.style.display = 'block';
    document.querySelector('.score-container').style.display = 'flex'; 
    
    resizeCanvas(); // ודא שהקנבס בגודל הנכון לפני יצירת אובייקטים
    generateFood();
    generateObstacles(numberOfObstacles);
    
    // מיקום הנחש צריך להתאפס במרכז הלוח החדש
    const responsiveGridSize = getResponsiveGridSize();
    const cols = Math.floor(canvas.width / responsiveGridSize);
    const rows = Math.floor(canvas.height / responsiveGridSize);
    snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2), color: 'green' }];
    direction = { x: 0, y: 0 }; // אפס כיוון
    score = 0;
    scoreDisplay.textContent = score; // אפס ניקוד

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    clearInterval(gameInterval);
    gameInterval = setInterval(updateGame, gameSpeed);
    draw(); // צייר את הלוח בפעם הראשונה
}

speedUpButton.addEventListener('click', () => changeGameSpeed(true));
speedDownButton.addEventListener('click', () => changeGameSpeed(false));

startButton.addEventListener('click', initializeGame);
restartButton.addEventListener('click', () => {
    gameOverScreen.style.display = 'none'; 
    showSettingsScreen(); 
});

// קריאה ראשונית בעת טעינת העמוד
showSettingsScreen();