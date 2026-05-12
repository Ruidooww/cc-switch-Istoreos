'use strict';
'require rpc';
'require ui';
'require view';

function num(v) {
	var n = Number(v || 0);
	return isNaN(n) ? 0 : n;
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

function metricCard(title, value, hint) {
	return E('div', {
		'class': 'cbi-section',
		'style': 'display:inline-block; min-width:180px; margin-right:12px; vertical-align:top'
	}, [
		E('h3', {}, title),
		E('div', { 'style': 'font-size:24px; font-weight:600' }, value),
		E('div', { 'class': 'cbi-value-description' }, hint || '')
	]);
}

function bar(width, label) {
	var pct = Math.max(0, Math.min(100, width || 0));
	return E('div', { 'style': 'min-width:160px' }, [
		E('div', { 'style': 'height:8px; background:#e8eaf6; border-radius:4px; overflow:hidden' }, [
			E('div', { 'style': 'height:8px; width:' + pct + '%; background:#6c72e6' })
		]),
		E('small', {}, label || '')
	]);
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
				E('td', { 'class': 'td left' }, fmt(item.duration_ms)),
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
				E('td', { 'class': 'td left', 'colspan': '12' }, emptyText)
			]));
		}

		return rows;
	},

	renderSummaryRows: function(items, emptyText) {
		var rows = [];
		var max = 0;

		for (var i = 0; i < items.length; i++)
			max = Math.max(max, num(items[i].total_tokens), num(items[i].requests));

		for (var j = 0; j < items.length; j++) {
			var item = items[j] || {};
			var width = max > 0 ? (Math.max(num(item.total_tokens), num(item.requests)) / max * 100) : 0;
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, item.name || _('未知')),
				E('td', { 'class': 'td left' }, String(item.requests || 0)),
				E('td', { 'class': 'td left' }, String(item.errors || 0)),
				E('td', { 'class': 'td left' }, fmt(item.input_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.output_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.cache_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.total_tokens)),
				E('td', { 'class': 'td left' }, fmt(item.estimated_cost, 6)),
				E('td', { 'class': 'td left' }, bar(width))
			]));
		}

		if (!rows.length) {
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'colspan': '9' }, emptyText)
			]));
		}

		return rows;
	},

	renderSummaryTable: function(title, items, emptyText) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, title),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th left' }, _('名称')),
					E('th', { 'class': 'th left' }, _('请求')),
					E('th', { 'class': 'th left' }, _('错误')),
					E('th', { 'class': 'th left' }, _('输入')),
					E('th', { 'class': 'th left' }, _('输出')),
					E('th', { 'class': 'th left' }, _('缓存')),
					E('th', { 'class': 'th left' }, _('合计')),
					E('th', { 'class': 'th left' }, _('费用')),
					E('th', { 'class': 'th left' }, _('占比'))
				])
			].concat(this.renderSummaryRows(items || [], emptyText)))
		]);
	},

	renderRequestTable: function(title, entries, emptyText) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, title),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th left' }, _('时间')),
					E('th', { 'class': 'th left' }, _('应用')),
					E('th', { 'class': 'th left' }, _('供应商')),
					E('th', { 'class': 'th left' }, _('模型')),
					E('th', { 'class': 'th left' }, _('状态')),
					E('th', { 'class': 'th left' }, _('耗时 ms')),
					E('th', { 'class': 'th left' }, _('输入')),
					E('th', { 'class': 'th left' }, _('输出')),
					E('th', { 'class': 'th left' }, _('缓存')),
					E('th', { 'class': 'th left' }, _('合计')),
					E('th', { 'class': 'th left' }, _('费用')),
					E('th', { 'class': 'th left' }, _('诊断'))
				])
			].concat(this.renderRows(entries || [], emptyText)))
		]);
	},

	render: function(data) {
		var summary = data.summary || {};
		var entries = data.entries || [];
		var errors = data.recent_errors || [];

		return E([], [
			E('h2', {}, _('CC Switch - 用量')),
			E('div', { 'class': 'cbi-map-descr' }, _('经过 ccswitch-proxy 的请求会记录在这里。API Key 不会写入日志；费用按供应商里填写的每百万 token 单价估算。')),
			E('div', {}, [
				metricCard(_('今日请求'), String(summary.today_requests || 0), _('错误 ') + String(summary.today_errors || 0)),
				metricCard(_('今日 Token'), fmt(summary.today_total_tokens), _('输入 ') + fmt(summary.today_input_tokens) + ' / 输出 ' + fmt(summary.today_output_tokens)),
				metricCard(_('今日费用'), fmt(summary.today_estimated_cost, 6), _('按供应商价格估算')),
				metricCard(_('累计请求'), String(summary.total_requests || data.total || 0), _('错误 ') + String(summary.error_requests || data.errors || 0)),
				metricCard(_('累计 Token'), fmt(summary.total_tokens), _('缓存 ') + fmt(summary.cache_tokens)),
				metricCard(_('累计费用'), fmt(summary.estimated_cost, 6), _('日志文件 ') + (data.log_file || '/etc/ccswitch/usage.jsonl'))
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': L.bind(this.handleExport, this) }, [ _('下载日志') ]),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': L.bind(this.handleTrim, this) }, [ _('按保留数量修剪') ]),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': L.bind(this.handleClear, this) }, [ _('清空日志') ])
			]),
			this.renderSummaryTable(_('按模型统计'), summary.by_model || [], _('暂无模型统计。')),
			this.renderSummaryTable(_('按供应商统计'), summary.by_provider || [], _('暂无供应商统计。')),
			this.renderSummaryTable(_('最近错误排行'), summary.by_error || [], _('暂无错误统计。')),
			this.renderRequestTable(_('最近请求'), entries, _('暂无代理请求记录。')),
			this.renderRequestTable(_('最近错误'), errors, _('暂无错误记录。'))
		]);
	}
});
