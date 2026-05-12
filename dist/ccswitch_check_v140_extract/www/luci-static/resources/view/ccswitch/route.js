'use strict';
'require form';
'require rpc';
'require uci';
'require ui';
'require view';

return view.extend({
	callProxyStatus: rpc.declare({
		object: 'ccswitch',
		method: 'proxy_status',
		expect: { '': {} }
	}),

	callProxyRestart: rpc.declare({
		object: 'ccswitch',
		method: 'proxy_restart',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			uci.load('ccswitch'),
			L.resolveDefault(this.callProxyStatus(), {})
		]);
	},

	handleRestart: function(map) {
		return map.save()
			.then(L.bind(function() {
				return this.callProxyRestart();
			}, this))
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('重启代理服务失败'));

				ui.addNotification(null, E('p', {}, res.running ? _('代理服务正在运行') : _('代理服务已停止')));
				window.setTimeout(function() { window.location.reload(); }, 700);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	render: function(data) {
		var status = data[1] || {};
		var m, s, o;

		m = new form.Map('ccswitch', _('CC Switch - 路由'),
			_('运行本地代理入口，供 Claude Code 或 Codex 兼容客户端使用；需要公网访问时再用 Lucky 反代出去。'));

		s = m.section(form.NamedSection, 'proxy', 'proxy', _('代理设置'));

		o = s.option(form.Flag, 'enabled', _('启用代理路由'));
		o.description = _('启用后，ccswitch-proxy 会监听配置的地址，并把请求转发到当前启用的供应商。');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'listen_address', _('监听地址'));
		o.placeholder = '127.0.0.1';
		o.default = '127.0.0.1';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!value)
				return _('监听地址不能为空');
			if (value === 'localhost' || value === '::' || value === '0.0.0.0')
				return true;
			if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value))
				return true;
			if (/^[0-9a-fA-F:]+$/.test(value) && value.indexOf(':') >= 0)
				return true;
			return _('请填写 IPv4/IPv6 地址、localhost、0.0.0.0 或 ::');
		};

		o = s.option(form.Value, 'listen_port', _('监听端口'));
		o.placeholder = '15721';
		o.default = '15721';
		o.datatype = 'port';
		o.rmempty = false;

		o = s.option(form.Flag, 'log_requests', _('记录请求'));
		o.description = _('请求元数据会写入 /etc/ccswitch/usage.jsonl，供用量页面展示。');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'upstream_timeout', _('上游超时'));
		o.description = _('等待上游供应商响应的秒数。');
		o.datatype = 'uinteger';
		o.default = '600';
		o.rmempty = false;

		o = s.option(form.Value, 'usage_retain', _('用量日志保留条数'));
		o.description = _('超过这个数量后，代理会自动只保留最新记录。');
		o.datatype = 'uinteger';
		o.default = '2000';
		o.rmempty = false;

		o = s.option(form.Button, '_restart', _('服务控制'));
		o.inputtitle = _('保存并重启代理');
		o.inputstyle = 'apply';
		o.onclick = L.bind(function(section_id, ev) {
			return this.handleRestart(m);
		}, this);

		s = m.section(form.NamedSection, 'proxy', 'proxy', _('当前状态'));

		o = s.option(form.DummyValue, '_daemon', _('代理服务'));
		o.cfgvalue = function() {
			if (status.running)
				return _('运行中');
			if (status.enabled)
				return _('已启用但未运行');
			return _('已停用');
		};

		o = s.option(form.DummyValue, '_listen', _('当前监听地址'));
		o.cfgvalue = function() {
			var address = uci.get('ccswitch', 'proxy', 'listen_address') || status.listen_address || '127.0.0.1';
			var port = uci.get('ccswitch', 'proxy', 'listen_port') || status.listen_port || '15721';
			return address + ':' + port;
		};

		o = s.option(form.DummyValue, '_client', _('HTTP 客户端'));
		o.cfgvalue = function() {
			return status.http_client || _('缺少 curl');
		};

		o = s.option(form.DummyValue, '_log_count', _('用量日志'));
		o.cfgvalue = function() {
			return _('总计 %s 条，错误 %s 条').format(status.log_count || 0, status.error_count || 0);
		};

		o = s.option(form.DummyValue, '_health', _('健康检查'));
		o.cfgvalue = function() {
			var address = uci.get('ccswitch', 'proxy', 'listen_address') || status.listen_address || '127.0.0.1';
			var port = uci.get('ccswitch', 'proxy', 'listen_port') || status.listen_port || '15721';
			return 'http://' + address + ':' + port + '/health';
		};

		o = s.option(form.DummyValue, '_routes', _('路由'));
		o.cfgvalue = function() {
			return '/v1/messages -> Claude Code\n/v1/responses, /v1/chat/completions, /v1/models -> Codex';
		};

		return m.render();
	}
});
