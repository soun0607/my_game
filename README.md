# 제작 중

프로그래밍 입문 수업에서 만드는 웹 게임입니다.

- 학번:202370013 / 이름:김소운
- 플레이: https://soun0607.github.io/my_game/

## 게임 소개
**오늘 밤 주인공은 나야나**는 봇 댄서와 댄스 배틀을 하는 1인용 리듬게임이다.
위에서 내려오는 화살표 노트가 판정선에 닿을 때 맞는 키를 누르면 춤을 추고 점수를 얻는다.
90초 동안 봇보다 점수가 높으면 승리한다.

## 조작법
| 키 | 하는 일 |
|---|---|
| ← ↓ ↑ → (방향키) | 같은 방향의 화살표 노트 치기 |
| Space | 레인 전체를 가로지르는 Space 노트 치기 |
| R | 언제든지 처음부터 다시 시작 |

- 동시 노트가 내려오면 두 방향키를 같이 누른다
- 판정: PERFECT 700점 / GREAT 500점 / GOOD 200점 / MISS 0점

## 게임 아이디어
'아이디어 1. 오늘 밤 주인공은 나야나' 가 제일 마음에 든다.
평소에 리듬게임을 좋아해서 선택했고, 생각보다 쉽게 만들 수 있을 것 같아서 선택했다.

## 진행 상황
- [x] 1주차: 자기소개 페이지
- [x] 2주차: GitHub 배포
- [x] 3주차: 게임 화면 그리기
- [x] 4주차: 게임 루프 (노트 떨어지기)
- [x] 5주차: 키 입력과 노트 판정
- [ ] 6주차: 점수, 제한 시간, 승패 (플레이 가능한 최소 버전)

## 사용한 에셋
모두 Kenney의 무료 에셋이며 CC0(퍼블릭 도메인) 라이선스다. `assets/` 폴더에 영어 이름으로 바꿔 넣었다.

| 파일 | 원본 | 출처 |
|---|---|---|
| player.png, player_left/down/up/right/space.png, bot.png, bot_left/down/up/right/space.png, dj.png, crowd1~4.png | Toon Characters (femalePerson cheer0·kick·duck·jump·cheer1·wide, malePerson cheer1·kick·duck·jump·wide, maleAdventurer interact, 각 캐릭터 back) | https://kenney.nl/assets/toon-characters |
| note_*.png, target_*.png, note_space.png | Input Prompts (keyboard_arrow_*, keyboard_space) | https://kenney.nl/assets/input-prompts |
| sparkle.png | Particle Pack (star_06) | https://kenney.nl/assets/particle-pack |
