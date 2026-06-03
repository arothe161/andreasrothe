// Load global header and footer on all pages
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Determine the correct paths based on current location
    const currentPath = window.location.pathname;
    const isRootPage = currentPath === '/' || currentPath.endsWith('/index.html');
    
    const headerPath = isRootPage ? './header.html' : '../header.html';
    const footerPath = isRootPage ? './footer.html' : '../footer.html';
    
    // Load header
    const headerResponse = await fetch(headerPath);
    const headerContent = await headerResponse.text();
    const existingNav = document.querySelector('nav');
    const headerContainer = document.createElement('div');
    headerContainer.innerHTML = headerContent;
    
    if (existingNav) {
      existingNav.replaceWith(headerContainer.querySelector('nav'));
    } else {
      document.body.insertBefore(headerContainer.querySelector('nav'), document.body.firstChild);
    }
    
    // Load footer
    const footerResponse = await fetch(footerPath);
    const footerContent = await footerResponse.text();
    const existingFooter = document.querySelector('footer');
    const footerContainer = document.createElement('div');
    footerContainer.innerHTML = footerContent;
    
    if (existingFooter) {
      existingFooter.replaceWith(footerContainer.querySelector('footer'));
    } else {
      document.body.appendChild(footerContainer.querySelector('footer'));
    }
  } catch (error) {
    console.warn('Could not load global header/footer:', error);
  }
});
