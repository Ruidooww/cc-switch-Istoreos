'use strict';
'require form';
'require rpc';
'require ui';
'require uci';
'require view';

return view.extend({
	callStatus: rpc.declare({
		object: 'ccswitch',
		method: 'status',
		params: [ 'app' ],
		expect: { '': {} }
	}),

	callApply: rpc.declare({
		object: 'ccswitch',
		method: 'apply',
		params: [ 'app', 'section' ],
		expect: { '': {} }
	}),

	callRestore: rpc.declare({
		object: 'ccswitch',
		method: 'restore',
		params: [ 'app', 'file' ],
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			uci.load('ccswitch'),
			L.resolveDefault(this.callStatus('codex'), {})
		]);
	},

	handleApply: function(map, section_id) {
		uci.set('ccswitch', section_id, 'enabled', '1');

		return map.save()
			.then(L.bind(function() {
				return this.callApply('codex', section_id);
			}, this))
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('启用供应商失败'));

				ui.addNotification(null, E('p', {}, res.message || _('供应商已启用')));
				window.setTimeout(function() { window.location.reload(); }, 700);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handleRestore: function() {
		return this.callRestore('codex', '')
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('恢复备份失败'));

				ui.addNotification(null, E('p', {}, res.message || _('备份已恢复')));
				window.setTimeout(function() { window.location.reload(); }, 700);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	render: function(data) {
		var status = data[1] || {};
		var m, s, o;

		m = new form.Map('ccswitch', _('CC Switch - Codex'),
			_('管理 Codex CLI API 供应商，并把当前启用的供应商写入 root 用户配置。'));

		s = m.section(form.NamedSection, 'global', 'global', _('状态'));

		o = s.option(form.DummyValue, '_current', _('当前供应商'));
		o.cfgvalue = function() {
			return status.current_name || status.current || _('无');
		};

		o = s.option(form.DummyValue, '_route_mode', _('代理模式'));
		o.cfgvalue = function() {
			return status.route_mode === 'proxy' ? _('走本地代理') : _('直连上游');
		};

		o = s.option(form.DummyValue, '_has_key', _('密钥状态'));
		o.cfgvalue = function() {
			return status.has_key ? _('已保存到 secrets 文件') : _('未保存');
		};

		o = s.option(form.DummyValue, '_paths', _('生效配置路径'));
		o.cfgvalue = function() {
			return (status.paths || []).join('\n') || '/root/.codex/auth.json\n/root/.codex/config.toml';
		};

		o = s.option(form.DummyValue, '_backup_dir', _('备份目录'));
		o.cfgvalue = function() {
			return status.backup_dir || '/etc/ccswitch/backups/codex';
		};

		o = s.option(form.DummyValue, '_backups', _('最近备份'));
		o.cfgvalue = function() {
			var backups = status.backups || [];
			return backups.length ? backups.slice(0, 8).join('\n') : _('暂无备份');
		};

		o = s.option(form.Button, '_restore_latest', _('恢复'));
		o.inputtitle = _('恢复最新备份');
		o.inputstyle = 'apply';
		o.onclick = L.bind(this.handleRestore, this);

		s = m.section(form.NamedSection, 'global', 'global', _('全局设置'));

		o = s.option(form.Value, 'codex_config_dir', _('Codex 配置目录'));
		o.default = '/root/.codex';
		o.rmempty = false;

		o = s.option(form.Value, 'backup_dir', _('备份根目录'));
		o.default = '/etc/ccswitch/backups';
		o.rmempty = false;

		o = s.option(form.Value, 'backup_retain', _('备份保留数量'));
		o.datatype = 'uinteger';
		o.default = '10';
		o.rmempty = false;

		o = s.option(form.ListValue, 'codex_route_mode', _('Codex 请求模式'));
		o.value('direct', _('直连上游'));
		o.value('proxy', _('走本地代理并记录用量'));
		o.default = 'direct';
		o.rmempty = false;

		s = m.section(form.GridSection, 'codex_provider', _('Codex 供应商'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('添加供应商');
		s.modaltitle = function(section_id) {
			var name = uci.get('ccswitch', section_id, 'name');
			return name ? _('编辑供应商') + ': ' + name : _('编辑供应商');
		};

		var renderCodexActions = s.renderRowActions;
		s.renderRowActions = L.bind(function(section_id) {
			var td = renderCodexActions.call(s, section_id);
			var container = td.lastElementChild || td;

			container.insertBefore(E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'title': _('启用'),
				'click': L.bind(function(ev) {
					ev.preventDefault();
					return this.handleApply(m, section_id);
				}, this)
			}, [ _('启用') ]), container.firstChild);

			return td;
		}, this);

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'name', _('名称'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'preset', _('供应商类型'));
		o.value('openai', _('OpenAI 兼容'));
		o.value('newapi', _('NewAPI'));
		o.value('openrouter', _('OpenRouter'));
		o.value('deepseek', _('DeepSeek'));
		o.value('siliconflow', _('SiliconFlow'));
		o.value('moonshot', _('Moonshot Kimi'));
		o.value('qwen', _('Qwen DashScope'));
		o.value('zhipu', _('Zhipu GLM'));
		o.value('volcengine', _('Volcengine Ark'));
		o.value('custom', _('自定义'));
		o.default = 'custom';

		o = s.option(form.Value, 'base_url', _('请求地址'));
		o.placeholder = 'https://api.openai.com/v1';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!/^https?:\/\//.test(value || ''))
				return _('请求地址必须以 http:// 或 https:// 开头');
			return true;
		};

		o = s.option(form.Value, 'api_key', _('API Key'));
		o.password = true;
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('留空则继续使用已保存的密钥');
		o.description = _('保存并启用后，真实 Key 会迁移到 /etc/ccswitch/secrets/，UCI 中只保留文件引用。');

		o = s.option(form.DummyValue, '_api_key_ref', _('密钥保存状态'));
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			return uci.get('ccswitch', section_id, 'api_key_ref') ? _('已保存') : _('未保存或等待保存');
		};

		o = s.option(form.Value, 'model', _('模型'));
		o.placeholder = 'gpt-5.1-codex';
		o.rmempty = false;

		o = s.option(form.ListValue, 'wire_api', _('接口类型'));
		o.value('responses', _('Responses'));
		o.value('chat', _('Chat Completions'));
		o.default = 'responses';
		o.rmempty = false;

		o = s.option(form.Value, 'input_price_million', _('输入价格 / 百万 token'));
		o.placeholder = '0';
		o.datatype = 'ufloat';
		o.modalonly = true;
		o.default = '0';
		o.rmempty = true;

		o = s.option(form.Value, 'output_price_million', _('输出价格 / 百万 token'));
		o.placeholder = '0';
		o.datatype = 'ufloat';
		o.modalonly = true;
		o.default = '0';
		o.rmempty = true;

		o = s.option(form.Value, 'notes', _('备注'));
		o.modalonly = true;
		o.rmempty = true;

		o = s.option(form.Button, '_apply_modal', _('保存并启用'));
		o.modalonly = true;
		o.inputtitle = _('保存并启用');
		o.inputstyle = 'apply';
		o.onclick = L.bind(function(section_id) {
			return this.handleApply(m, section_id);
		}, this);

		return m.render();
	}
});
