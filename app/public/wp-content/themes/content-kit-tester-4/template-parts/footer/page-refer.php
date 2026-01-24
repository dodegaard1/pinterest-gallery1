<script type="text/javascript">var $ = window.jQuery;</script><script src="<?php echo get_template_directory_uri(); ?>/assets/js/webflow.js?v=1769019464" type="text/javascript"></script>
<script>
document.getElementById('copy-url-button').addEventListener('click', function() {
const url = 'https://abeautifulunion.com';
navigator.clipboard.writeText(url)
.then(() => {
// Permanent success state
this.classList.add('copied');
this.textContent = 'Copied!';
})
.catch(err => {
console.error('Failed to copy:', err);
alert('Failed to copy URL to clipboard');
});
});
</script>
<style>
#copy-url-button {
transition: all 0.3s ease;
/* Optional: Different style for copied state */
&.copied {
background-color: #4CAF50; /* Green color for success */
color: white;
}
}
</style>