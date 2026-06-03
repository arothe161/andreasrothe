// Load global header and footer on all pages
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Determine the correct paths based on current location
    const currentPath = window.location.pathname;
    const headerPath = './header.html';
    const footerPath = './footer.html';
    
    // Helper function to execute scripts in a container
    function executeScripts(container) {
      const scripts = container.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.innerHTML) {
          eval(script.innerHTML);
        }
      });
    }
    
    // Load header
    const headerResponse = await fetch(headerPath);
    const headerContent = await headerResponse.text();
    const existingNav = document.querySelector('nav');
    const headerContainer = document.createElement('div');
    headerContainer.innerHTML = headerContent;
    const newNav = headerContainer.querySelector('nav');
    
    if (existingNav && newNav) {
      existingNav.replaceWith(newNav);
    }
    
    // Load footer
    const footerResponse = await fetch(footerPath);
    const footerContent = await footerResponse.text();
    const existingFooter = document.querySelector('footer');
    const footerContainer = document.createElement('div');
    footerContainer.innerHTML = footerContent;
    const newFooter = footerContainer.querySelector('footer');
    
    if (existingFooter && newFooter) {
      existingFooter.replaceWith(newFooter);
      const yearEl = document.getElementById('year');
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }
  } catch (error) {
    console.warn('Could not load global header/footer:', error);
  }
});
