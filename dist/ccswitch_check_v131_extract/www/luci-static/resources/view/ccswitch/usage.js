'use strict';
'require rpc';
'require view';

return view.extend({
	callUsage: rpc.declare({
		object: 'ccswitch',
		method: 'usage',
		params: [ 'limit' ],
		expect: { '': {} }
	}),

	load: function() {
		return L.resolveDefault(this.callUsage(100), {});
	},

	render: function(data) {
		var entries = data.entries || [];
		var rows = [];

		for (var i = entries.length - 1; i >= 0; i--) {
			var item = entries[i] || {};
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, item.time || ''),
				E('td', { 'class': 'td left' }, item.app || ''),
				E('td', { 'class': 'td left' }, item.provider || ''),
				E('td', { 'class': 'td left' }, item.model || ''),
				E('td', { 'class': 'td left' }, item.path || ''),
				E('td', { 'class': 'td left' }, item.status != null ? String(item.status) : ''),
				E('td', { 'class': 'td left' }, item.duration_ms != null ? String(item.duration_ms) : ''),
				E('td', { 'class': 'td left' }, item.response_bytes != null ? String(item.response_bytes) : '')
			]));
		}

		if (!rows.length) {
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'colspan': '8' }, _('暂无代理请求记录。'))
			]));
		}

		return E([], [
			E('h2', {}, _('CC Switch - 用量')),
			E('div', { 'class': 'cbi-map-descr' }, _('经过 ccswitch-proxy 的请求会记录在这里。API Key 不会写入日志。')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('概览')),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', 'width': '30%' }, _('日志文件')),
						E('td', { 'class': 'td left' }, data.log_file || '/etc/ccswitch/usage.jsonl')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, _('请求总数')),
						E('td', { 'class': 'td left' }, data.total != null ? String(data.total) : '0')
					])
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('最近请求')),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th left' }, _('时间')),
						E('th', { 'class': 'th left' }, _('应用')),
						E('th', { 'class': 'th left' }, _('供应商')),
						E('th', { 'class': 'th left' }, _('模型')),
						E('th', { 'class': 'th left' }, _('路径')),
						E('th', { 'class': 'th left' }, _('状态')),
						E('th', { 'class': 'th left' }, _('耗时 ms')),
						E('th', { 'class': 'th left' }, _('字节'))
					])
				].concat(rows))
			])
		]);
	}
});
