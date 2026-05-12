'use strict';
'require rpc';
'require ui';
'require view';

function num(v) {
	var n = Number(v || 0);
	return isNaN(n) ? 0 : n;
}

function sum(entries, key) {
	var total = 0;
	for (var i = 0; i < entries.length; i++)
		total += num(entries[i][key]);
	return total;
}

function fmt(n, digits) {
	return num(n).toFixed(digits == null ? 0 : digits);
}

function downloadText(filename, content) {
	var blob = new Blob([ content || '' ], { type: 'application/jsonl;charset=utf-8' });
	var url = URL.createObjectURL(blob);
	var a = E('a', { href: url, download: filename || 'ccswitch-usage.jsonl' });
	document.body.appendChild(a);
	a.click();
	window.setTimeout(function() {
		URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}, 0);
}

return view.extend({
	callUsage: rpc.declare({
		object: 'ccswitch',
		method: 'usage',
		params: [ 'limit' ],
		expect: { '': {} }
	}),

	callUsageClear: rpc.declare({
		object: 'ccswitch',
		method: 'usage_clear',
		expect: { '': {} }
	}),

	callUsageTrim: rpc.declare({
		object: 'ccswitch',
		method: 'usage_trim',
		params: [ 'limit' ],
		expect: { '': {} }
	}),

	callUsageExport: rpc.declare({
		object: 'ccswitch',
		method: 'usage_export',
		params: [ 'limit' ],
		expect: { '': {} }
	}),

	load: function() {
		return L.resolveDefault(this.callUsage(100), {});
	},

	handleClear: function() {
		if (!window.confirm(_('确定清空所有用量日志吗？')))
			return Promise.resolve();

		return this.callUsageClear()
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('清空日志失败'));
				ui.addNotification(null, E('p', {}, _('日志已清空')));
				window.setTimeout(function() { window.location.reload(); }, 500);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handleTrim: function() {
		return this.callUsageTrim(0)
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('修剪日志失败'));
				ui.addNotification(null, E('p', {}, _('日志已按保留数量修剪')));
				window.setTimeout(function() { window.location.reload(); }, 500);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handleExport: function() {
		return this.callUsageExport(5000)
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('导出日志失败'));
				downloadText(res.filename, res.content || '');
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	renderRows: function(entries, emptyText) {
		var rows = [];

		for (var i = entries.length - 1; i >= 0; i--) {
			var item = entries[i] || {};
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, item.time || ''),
				E('td', { 'class': 'td left' }, item.app || ''),
				E('td', { 'class': 'td left' }, item.provider || ''),
				E('td', { 'class': 'td left' }, item.model || ''),
				E('td', { 'class': 'td left' }, item.status != null ? String(item.status) : ''),
				E('td', { 'class': 'td left' }, fmt(item.input_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.output_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.cache_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.total_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.estimated_cost, 6)),
				E('td', { 'class': 'td left' }, item.hint || '')
			]));
		}

		if (!rows.length) {
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'colspan': '11' }, emptyText)
			]));
		}

		return rows;
	},

	render: function(data) {
		var entries = data.entries || [];
		var errors = data.recent_errors || [];
		var displayInput = sum(entries, 'input_tokens');
		var displayOutput = sum(entries, 'output_tokens');
		var displayCache = sum(entries, 'cache_tokens');
		var displayTotal = sum(entries, 'total_tokens');
		var displayCost = sum(entries, 'estimated_cost');

		return E([], [
			E('h2', {}, _('CC Switch - 用量')),
			E('div', { 'class': 'cbi-map-descr' }, _('经过 ccswitch-proxy 的请求会记录在这里。API Key 不会写入日志；费用按供应商里填写的每百万 token 单价估算。')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('概览')),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', 'width': '30%' }, _('日志文件')),
						E('td', { 'class': 'td left' }, data.log_file || '/etc/ccswitch/usage.jsonl')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, _('日志总请求')),
						E('td', { 'class': 'td left' }, data.total != null ? String(data.total) : '0')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, _('错误请求')),
						E('td', { 'class': 'td left' }, data.errors != null ? String(data.errors) : '0')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, _('当前显示 token')),
						E('td', { 'class': 'td left' }, _('输入 %s / 输出 %s / 缓存 %s / 合计 %s').format(fmt(displayInput), fmt(displayOutput), fmt(displayCache), fmt(displayTotal)))
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, _('当前显示估算费用')),
						E('td', { 'class': 'td left' }, fmt(displayCost, 6))
					])
				]),
				E('div', { 'class': 'cbi-page-actions' }, [
					E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': L.bind(this.handleExport, this) }, [ _('下载日志') ]),
					' ',
					E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': L.bind(this.handleTrim, this) }, [ _('按保留数量修剪') ]),
					' ',
					E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': L.bind(this.handleClear, this) }, [ _('清空日志') ])
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
						E('th', { 'class': 'th left' }, _('状态')),
						E('th', { 'class': 'th left' }, _('输入')),
						E('th', { 'class': 'th left' }, _('输出')),
						E('th', { 'class': 'th left' }, _('缓存')),
						E('th', { 'class': 'th left' }, _('合计')),
						E('th', { 'class': 'th left' }, _('费用')),
						E('th', { 'class': 'th left' }, _('诊断'))
					])
				].concat(this.renderRows(entries, _('暂无代理请求记录。'))))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('最近错误')),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th left' }, _('时间')),
						E('th', { 'class': 'th left' }, _('应用')),
						E('th', { 'class': 'th left' }, _('供应商')),
						E('th', { 'class': 'th left' }, _('模型')),
						E('th', { 'class': 'th left' }, _('状态')),
						E('th', { 'class': 'th left' }, _('输入')),
						E('th', { 'class': 'th left' }, _('输出')),
						E('th', { 'class': 'th left' }, _('缓存')),
						E('th', { 'class': 'th left' }, _('合计')),
						E('th', { 'class': 'th left' }, _('费用')),
						E('th', { 'class': 'th left' }, _('诊断'))
					])
				].concat(this.renderRows(errors, _('暂无错误记录。'))))
			])
		]);
	}
});
