const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 좌표 연습 =====
// fillRect(x, y, 가로, 세로): x, y는 사각형의 왼쪽 위 꼭짓점

// 1. (0, 0)에 빨간 사각형 → 왼쪽 위 구석
ctx.fillStyle = "red";
ctx.fillRect(0, 0, 50, 50);

// 2. (750, 0)에 노란 사각형 → 오른쪽 위 구석 (800 - 50 = 750)
ctx.fillStyle = "yellow";
ctx.fillRect(750, 0, 50, 50);

// 3. (0, 550)에 초록 사각형 → 왼쪽 아래 구석 (600 - 50 = 550)
ctx.fillStyle = "green";
ctx.fillRect(0, 550, 50, 50);

// 4. (400, 300)에 흰 사각형 → 가운데
ctx.fillStyle = "white";
ctx.fillRect(400, 100, 20, 20);

// 5. 각 사각형 옆에 좌표를 흰 글씨로 쓴다
ctx.fillStyle = "white";            // 글자 색 (글자 쓰기 전에 정해야 한다)
ctx.font = "14px sans-serif";       // 글씨 크기 14
ctx.fillText("(0, 0)", 58, 30);     // 빨간 사각형 오른쪽
ctx.fillText("(750, 0)", 685, 30);  // 노란 사각형 왼쪽
ctx.fillText("(0, 550)", 58, 580);  // 초록 사각형 오른쪽
ctx.fillText("(400, 100)", 428, 115); // 흰 사각형 오른쪽
