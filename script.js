const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 위치와 크기 모음 (여기 숫자만 바꾸면 화면이 바뀐다) =====

// 레인: 가운데 세로 줄 4개
const LANE_X = 280;        // 첫 번째 레인의 왼쪽 x
const LANE_TOP = 170;      // 레인이 시작하는 y
const LANE_WIDTH = 60;     // 레인 한 칸의 너비
const LANE_HEIGHT = 360;   // 레인의 높이 (170 + 360 = 530까지)
const LANE_COUNT = 4;      // 레인 개수 (← ↓ ↑ →)

// 판정선: 노트가 여기 닿을 때 키를 누른다
const JUDGE_Y = 500;

// 노트: [몇 번째 레인(0~3), y 위치]
const NOTES = [
  [0, 220],
  [2, 300],
  [3, 380],
];
const NOTE_HEIGHT = 20;
const SPACE_NOTE_Y = 440;  // Space 노트(레인 4개를 가로지르는 긴 막대)의 y

// 캐릭터: (x, y)는 머리 원의 중심
const PLAYER_X = 140;
const PLAYER_Y = 400;
const BOT_X = 660;
const BOT_Y = 400;
const HEAD_RADIUS = 24;    // 머리 반지름
const BODY_WIDTH = 50;     // 몸 가로
const BODY_HEIGHT = 70;    // 몸 세로

// DJ 부스: 위쪽 가운데
const DJ_X = 400;          // DJ 머리 중심 x
const DJ_Y = 30;           // DJ 머리 중심 y

// 색
const STAGE_COLOR = "#2a1b3d";   // 무대 배경 (어두운 보라)
const PLAYER_COLOR = "#a6e8f4";  // 나 (분홍)
const BOT_COLOR = "#8fd18f";     // 초급 봇 (초록)
const NOTE_COLORS = ["#ff8fa3", "#ffd166", "#8fd3ff", "#c3a6ff"]; // 레인별 노트 색
const SPACE_NOTE_COLOR = "#ffffff";

// ===== 그리기 =====

// 1. 배경: 도화지 전체를 어두운 보라색 무대로 칠한다
ctx.fillStyle = STAGE_COLOR;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 2. DJ 부스: 헤드폰 쓴 DJ 머리 + 부스 책상
ctx.fillStyle = "#e0c3a0";                       // DJ 머리 색
ctx.beginPath();
ctx.arc(DJ_X, DJ_Y, 14, 0, Math.PI * 2);         // DJ 머리 (원)
ctx.fill();
ctx.strokeStyle = "#333333";                      // 헤드폰 색
ctx.lineWidth = 4;
ctx.beginPath();
ctx.arc(DJ_X, DJ_Y, 17, Math.PI, Math.PI * 2);   // 머리 위 반원 = 헤드폰 띠
ctx.stroke();
ctx.fillStyle = "#4a3a63";                        // 부스 책상 색
ctx.fillRect(DJ_X - 60, DJ_Y + 14, 120, 36);     // 머리 아래 책상
ctx.fillStyle = "white";
ctx.font = "16px sans-serif";
ctx.textAlign = "center";                         // 글자를 x 기준 가운데 정렬
ctx.fillText("DJ", DJ_X, DJ_Y + 38);

// 3. 점수판
ctx.font = "22px sans-serif";
ctx.textAlign = "left";
ctx.fillText("나: 0", 20, 35);                   // 왼쪽 위: 내 점수
ctx.textAlign = "right";
ctx.fillText("봇: 0", 780, 35);                  // 오른쪽 위: 봇 점수 (x=780에서 끝나게)
ctx.font = "16px sans-serif";
ctx.textAlign = "left";
ctx.fillText("실패: 0/5", 20, 62);               // 내 실패 횟수
ctx.textAlign = "right";
ctx.fillText("실패: 0/5", 780, 62);              // 봇 실패 횟수
ctx.textAlign = "center";
ctx.fillText("STAGE 1 초급", 400, 110);          // 가운데: 스테이지
ctx.fillText("남은 시간: 60", 400, 132);         // 가운데: 남은 시간

// 4. 레인 4개: 반투명 흰 칸 + 칸 사이 선 + 위쪽 화살표 글자
const LANE_LABELS = ["←", "↓", "↑", "→"];
for (let i = 0; i < LANE_COUNT; i++) {
  const x = LANE_X + i * LANE_WIDTH;              // i번째 레인의 왼쪽 x
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";    // 아주 연한 흰색
  ctx.fillRect(x, LANE_TOP, LANE_WIDTH, LANE_HEIGHT);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, LANE_TOP, LANE_WIDTH, LANE_HEIGHT); // 레인 테두리
  ctx.fillStyle = "white";
  ctx.font = "22px sans-serif";
  ctx.fillText(LANE_LABELS[i], x + LANE_WIDTH / 2, LANE_TOP - 10); // 레인 위 화살표
}

// 5. 노트: 레인 위에 내려오는 중인 색깔 사각형
for (const [lane, y] of NOTES) {
  ctx.fillStyle = NOTE_COLORS[lane];
  ctx.fillRect(LANE_X + lane * LANE_WIDTH + 5, y, LANE_WIDTH - 10, NOTE_HEIGHT);
}

// 6. Space 노트: 레인 4개를 가로지르는 긴 막대
ctx.fillStyle = SPACE_NOTE_COLOR;
ctx.fillRect(LANE_X + 5, SPACE_NOTE_Y, LANE_WIDTH * LANE_COUNT - 10, 12);

// 7. 판정선: 레인 아래쪽 가로 흰 선
ctx.strokeStyle = "white";
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(LANE_X, JUDGE_Y);                          // 선 시작점
ctx.lineTo(LANE_X + LANE_WIDTH * LANE_COUNT, JUDGE_Y); // 선 끝점
ctx.stroke();

// 8. 캐릭터 그리기 함수: 원 머리 + 사각형 몸 + 이름표
function drawDancer(x, y, color, name) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, HEAD_RADIUS, 0, Math.PI * 2);   // 머리 (원의 x, y는 중심)
  ctx.fill();
  ctx.fillRect(x - BODY_WIDTH / 2, y + HEAD_RADIUS + 4, BODY_WIDTH, BODY_HEIGHT); // 몸 (사각형의 x, y는 왼쪽 위)
  ctx.fillStyle = "white";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, x, y + HEAD_RADIUS + BODY_HEIGHT + 26); // 몸 아래 이름표
}

drawDancer(PLAYER_X, PLAYER_Y, PLAYER_COLOR, "나");   // 왼쪽 아래: 나
drawDancer(BOT_X, BOT_Y, BOT_COLOR, "초급 봇");       // 오른쪽 아래: 봇

// 9. 관중: 화면 맨 아래 한 줄에 작은 원 머리 여러 개
ctx.fillStyle = "#5a4a70";
for (let x = 20; x < canvas.width; x += 40) {
  ctx.beginPath();
  ctx.arc(x, 588, 12, 0, Math.PI * 2);
  ctx.fill();
}
