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
			L.resolveDefault(this.callStatus('claude'), {})
		]);
	},

	handleApply: function(map, section_id) {
		uci.set('ccswitch', section_id, 'enabled', '1');

		return map.save()
			.then(L.bind(function() {
				return this.callApply('claude', section_id);
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
		return this.callRestore('claude', '')
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

		m = new form.Map('ccswitch', _('CC Switch - Claude Code'),
			_('管理 Claude Code API 供应商，并把当前启用的供应商写入 root 用户配置。'));

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
			return (status.paths || []).join('\n') || '/root/.claude/settings.json';
		};

		o = s.option(form.DummyValue, '_backup_dir', _('备份目录'));
		o.cfgvalue = function() {
			return status.backup_dir || '/etc/ccswitch/backups/claude';
		};

		o = s.option(form.DummyValue, '_backups', _('最近备份'));
		o.cfgvalue = function() {
			var backups = status.backups || [];
			return backups.length ? backups.slice(0, 5).join('\n') : _('暂无备份');
		};

		o = s.option(form.Button, '_restore_latest', _('恢复'));
		o.inputtitle = _('恢复最新备份');
		o.inputstyle = 'apply';
		o.onclick = L.bind(this.handleRestore, this);

		s = m.section(form.NamedSection, 'global', 'global', _('全局设置'));

		o = s.option(form.Value, 'claude_config_dir', _('Claude 配置目录'));
		o.default = '/root/.claude';
		o.rmempty = false;

		o = s.option(form.Value, 'backup_dir', _('备份根目录'));
		o.default = '/etc/ccswitch/backups';
		o.rmempty = false;

		o = s.option(form.Value, 'backup_retain', _('备份保留数量'));
		o.datatype = 'uinteger';
		o.default = '10';
		o.rmempty = false;

		o = s.option(form.ListValue, 'claude_route_mode', _('Claude 请求模式'));
		o.value('direct', _('直连上游'));
		o.value('proxy', _('走本地代理并记录用量'));
		o.default = 'direct';
		o.rmempty = false;

		s = m.section(form.GridSection, 'claude_provider', _('Claude Code 供应商'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('添加供应商');
		s.modaltitle = function(section_id) {
			var name = uci.get('ccswitch', section_id, 'name');
			return name ? _('编辑供应商') + ': ' + name : _('编辑供应商');
		};

		var renderClaudeActions = s.renderRowActions;
		s.renderRowActions = L.bind(function(section_id) {
			var td = renderClaudeActions.call(s, section_id);
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
		o.value('anthropic', _('Anthropic 兼容'));
		o.value('newapi_anthropic', _('NewAPI / Anthropic 代理'));
		o.value('proxy_anthropic', _('Claude 代理兼容'));
		o.value('deepseek_anthropic', _('DeepSeek Anthropic 接口'));
		o.value('custom', _('自定义'));
		o.default = 'custom';

		o = s.option(form.Value, 'website_url', _('官网地址'));
		o.placeholder = 'https://platform.deepseek.com';
		o.modalonly = true;
		o.rmempty = true;

		o = s.option(form.Value, 'base_url', _('请求地址'));
		o.placeholder = 'https://api.deepseek.com/anthropic';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (!/^https?:\/\//.test(value || ''))
				return _('请求地址必须以 http:// 或 https:// 开头');
			return true;
		};

		o = s.option(form.Flag, 'is_full_url', _('完整 URL'));
		o.description = _('把请求地址当成完整的 Claude API 服务地址，不自动追加路径。');
		o.modalonly = true;
		o.default = '0';

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

		o = s.option(form.ListValue, 'api_format', _('API 格式'));
		o.value('anthropic', _('Anthropic Messages（原生）'));
		o.value('openai_chat', _('OpenAI Chat（需要代理）'));
		o.value('openai_responses', _('OpenAI Responses（需要代理）'));
		o.default = 'anthropic';
		o.modalonly = true;

		o = s.option(form.ListValue, 'api_key_field', _('认证字段'));
		o.value('ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN');
		o.value('ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY');
		o.default = 'ANTHROPIC_AUTH_TOKEN';
		o.modalonly = true;
		o.rmempty = false;

		o = s.option(form.Value, 'model', _('模型'));
		o.placeholder = 'claude-sonnet-4-5';
		o.rmempty = false;

		o = s.option(form.Value, 'haiku_model', _('Haiku 默认模型'));
		o.placeholder = 'claude-haiku-4-5';
		o.modalonly = true;
		o.rmempty = true;

		o = s.option(form.Value, 'sonnet_model', _('Sonnet 默认模型'));
		o.placeholder = 'claude-sonnet-4-5';
		o.modalonly = true;
		o.rmempty = true;

		o = s.option(form.Value, 'opus_model', _('Opus 默认模型'));
		o.placeholder = 'claude-opus-4-1';
		o.modalonly = true;
		o.rmempty = true;

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

		o = s.option(form.Flag, 'hide_ai_signature', _('隐藏 AI 签名'));
		o.modalonly = true;
		o.default = '0';

		o = s.option(form.Flag, 'teammates_mode', _('Teammates 模式'));
		o.modalonly = true;
		o.default = '0';

		o = s.option(form.Flag, 'enable_tool_search', _('启用 Tool Search'));
		o.modalonly = true;
		o.default = '0';

		o = s.option(form.Flag, 'max_thinking_enabled', _('最大思考'));
		o.modalonly = true;
		o.default = '0';

		o = s.option(form.Flag, 'disable_auto_update', _('禁用自动更新'));
		o.modalonly = true;
		o.default = '0';

		o = s.option(form.DummyValue, '_preview', _('配置 JSON 预览'));
		o.modalonly = true;
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var keyField = uci.get('ccswitch', section_id, 'api_key_field') || 'ANTHROPIC_AUTH_TOKEN';
			var apiKey = uci.get('ccswitch', section_id, 'api_key') || '';
			var apiKeyRef = uci.get('ccswitch', section_id, 'api_key_ref') || '';
			var model = uci.get('ccswitch', section_id, 'model') || '';
			var routeMode = uci.get('ccswitch', 'global', 'claude_route_mode') || 'direct';
			var config = {
				env: {
					ANTHROPIC_BASE_URL: routeMode === 'proxy' ? _('本地代理地址') : (uci.get('ccswitch', section_id, 'base_url') || ''),
					ANTHROPIC_MODEL: model,
					ANTHROPIC_DEFAULT_HAIKU_MODEL: uci.get('ccswitch', section_id, 'haiku_model') || model,
					ANTHROPIC_DEFAULT_SONNET_MODEL: uci.get('ccswitch', section_id, 'sonnet_model') || model,
					ANTHROPIC_DEFAULT_OPUS_MODEL: uci.get('ccswitch', section_id, 'opus_model') || model
				}
			};

			config.env[keyField] = (apiKey || apiKeyRef) ? '********' : '';

			if (uci.get('ccswitch', section_id, 'hide_ai_signature') === '1')
				config.includeCoAuthoredBy = false;
			if (uci.get('ccswitch', section_id, 'teammates_mode') === '1')
				config.forceLoginMethod = 'console';
			if (uci.get('ccswitch', section_id, 'enable_tool_search') === '1')
				config.enableToolSearch = true;
			if (uci.get('ccswitch', section_id, 'max_thinking_enabled') === '1')
				config.env.MAX_THINKING_TOKENS = '32000';
			if (uci.get('ccswitch', section_id, 'disable_auto_update') === '1')
				config.disableAutoUpdate = true;

			return E('pre', { 'style': 'white-space: pre-wrap; max-height: 260px; overflow: auto' },
				JSON.stringify(config, null, 2));
		};

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
