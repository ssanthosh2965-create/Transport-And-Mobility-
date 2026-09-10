document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('search-btn');
  const logo = document.getElementById('medifind-logo');

  searchBtn.addEventListener('click', () => {
    alert('Welcome to MEDIFIND! Starting search...');
  });

  logo.addEventListener('click', () => {
    logo.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      logo.style.transform = 'rotate(0deg)';
    }, 500);
  });
});
