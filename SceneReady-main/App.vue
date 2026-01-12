<script>
	import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
	import { initTheme } from '@/common/theme.js';
	export default {
		onLaunch: async function() {
			console.log('App Launch')
			initTheme()
			await uniIdPageInit()
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style lang="scss">
	@import '@/common/common.scss';

	/*每个页面公共css */
</style>
