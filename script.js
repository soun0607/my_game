const games = document.querySelectorAll('.game');
const selection = document.querySelector('.selection');
const todayDate = document.querySelector('#today-date');

if (todayDate) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  todayDate.dateTime = `${year}-${month}-${day}`;
  todayDate.textContent = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(today);
}

games.forEach((game) => {
  game.addEventListener('click', () => {
    games.forEach((item) => {
      item.setAttribute('aria-pressed', String(item === game));
    });
    selection.textContent = `선택한 게임: ${game.querySelector('.game-name').textContent}`;
  });
});
