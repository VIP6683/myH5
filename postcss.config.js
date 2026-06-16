export default {
	plugins: {
		autoprefixer: {},
		'postcss-px-to-viewport-8-plugin': {
			unitToConvert: 'px',
			// 375 设计稿（1x 移动端基准宽度）
			viewportWidth: 375,
			unitPrecision: 6,
			// 全部 px（含字号、字距）转 vw
			propList: ['*'],
			viewportUnit: 'vw',
			fontViewportUnit: 'vw',
			selectorBlackList: ['.ignore-vw'],
			minPixelValue: 1,
			mediaQuery: false,
			replace: true,
			landscape: false,
			exclude: [/node_modules/]
		}
	}
};
