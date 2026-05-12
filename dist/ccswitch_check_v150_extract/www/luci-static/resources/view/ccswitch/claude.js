'use strict';
'require form';
'require rpc';
'require ui';
'require uci';
'require view';

function secretState(section_id) {
	return uci.get('ccswitch', section_id, 'api_key_ref') ? _('已保存') : _('未保存或等待保存');
}

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

	callPreview: rpc.declare({
		object: 'ccswitch',
		method: 'preview',
		params: [ 'app', 'section' ],
		expect: { '': {} }
	}),

	callTest: rpc.declare({
		object: 'ccswitch',
		method: 'test',
		params: [ 'app', 'section' ],
		expect: { '': {} }
	}),

	callClone: rpc.declare({
		object: 'ccswitch',
		method: 'clone',
		params: [ 'app', 'section' ],
		expect: { '': {} }
	}),

	callFailover: rpc.declare({
		object: 'ccswitch',
		method: 'failover',
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

	showTextModal: function(title, text) {
		ui.showModal(title, [
			E('pre', { 'style': 'white-space: pre-wrap; max-height: 420px; overflow: auto' }, text || ''),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [ _('关闭') ])
			])
		]);
	},

	showApplyPreview: function(section_id, preview) {
		var name = uci.get('ccswitch', section_id, 'name') || section_id;

		ui.showModal(_('启用前预览') + ' - ' + name, [
			E('p', {}, _('确认后会备份当前 Claude 配置，并写入下面的内容。API Key 已打码。')),
			E('pre', { 'style': 'white-space: pre-wrap; max-height: 420px; overflow: auto' }, preview || ''),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [ _('取消') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': L.bind(function(ev) {
						var btn = ev.currentTarget;
						btn.disabled = true;
						return this.callApply('claude', section_id)
							.then(function(res) {
								if (!res || res.ok === false)
									throw new Error(res && res.error ? res.error : _('启用供应商失败'));
								ui.hideModal();
								ui.addNotification(null, E('p', {}, res.message || _('供应商已启用')));
								window.setTimeout(function() { window.location.reload(); }, 700);
							})
							.catch(function(err) {
								btn.disabled = false;
								ui.addNotification(null, E('p', {}, err.message || err), 'danger');
							});
					}, this)
				}, [ _('确认启用') ])
			])
		]);
	},

	handleApply: function(map, section_id) {
		uci.set('ccswitch', section_id, 'enabled', '1');

		return map.save()
			.then(L.bind(function() {
				return this.callPreview('claude', section_id);
			}, this))
			.then(L.bind(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('生成预览失败'));
				this.showApplyPreview(section_id, res.content || '');
			}, this))
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handlePreview: function(map, section_id) {
		return map.save()
			.then(L.bind(function() {
				return this.callPreview('claude', section_id);
			}, this))
			.then(L.bind(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('生成预览失败'));
				this.showTextModal(_('配置预览'), res.content || '');
			}, this))
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handleTest: function(map, section_id) {
		return map.save()
			.then(L.bind(function() {
				return this.callTest('claude', section_id);
			}, this))
			.then(L.bind(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('测试供应商失败'));

				this.showTextModal(_('供应商测试结果'), [
					'供应商: ' + (res.provider || ''),
					'模型: ' + (res.model || ''),
					'状态码: ' + (res.status != null ? res.status : ''),
					'诊断: ' + (res.hint || ''),
					'请求地址: ' + (res.url || ''),
					'',
					'响应摘录:',
					res.body || ''
				].join('\n'));
			}, this))
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handleClone: function(map, section_id) {
		return map.save()
			.then(L.bind(function() {
				return this.callClone('claude', section_id);
			}, this))
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('克隆供应商失败'));
				ui.addNotification(null, E('p', {}, _('供应商已克隆')));
				window.setTimeout(function() { window.location.reload(); }, 700);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, err.message || err), 'danger');
			});
	},

	handleFailover: function(map, section_id) {
		return map.save()
			.then(L.bind(function() {
				return this.callFailover('claude', section_id);
			}, this))
			.then(function(res) {
				if (!res || res.ok === false)
					throw new Error(res && res.error ? res.error : _('切换到备用供应商失败'));
				ui.addNotification(null, E('p', {}, res.message || _('已切换到备用供应商')));
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
		var providers = uci.sections('ccswitch', 'claude_provider');
		var m, s, o;

		m = new form.Map('ccswitch', _('CC Switch - Claude Code'),
			_('管理 Claude Code API 供应商，并把当前启用的供应商写入 root 用户配置。'));

		s = m.section(form.NamedSection, 'global', 'global', _('状态'));

		o = s.option(form.DummyValue, '_current', _('当前供应商'));
		o.cfgvalue = function() {
			return status.current_name || status.current || _('无');
		};

		o = s.option(form.DummyValue, '_route_mode', _('请求模式'));
		o.cfgvalue = function() {
			return status.route_mode === 'proxy' ? _('走本地代理') : _('直连上游');
		};

		o = s.option(form.DummyValue, '_has_key', _('当前密钥状态'));
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
			var buttons = [
				[ _('启用'), 'cbi-button-apply', this.handleApply ],
				[ _('测试'), 'cbi-button-neutral', this.handleTest ],
				[ _('预览'), 'cbi-button-neutral', this.handlePreview ],
				[ _('克隆'), 'cbi-button-neutral', this.handleClone ],
				[ _('备用'), 'cbi-button-neutral', this.handleFailover ]
			];

			for (var i = buttons.length - 1; i >= 0; i--) {
				container.insertBefore(E('button', {
					'class': 'btn cbi-button ' + buttons[i][1],
					'title': buttons[i][0],
					'click': L.bind(function(fn, ev) {
						ev.preventDefault();
						return fn.call(this, m, section_id);
					}, this, buttons[i][2])
				}, [ buttons[i][0] ]), container.firstChild);
			}

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
		o.description = _('把请求地址当成完整 Claude API 服务地址，不自动追加路径。');
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
		o.cfgvalue = secretState;

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

		o = s.option(form.ListValue, 'fallback_provider', _('备用供应商'));
		o.modalonly = true;
		o.rmempty = true;
		o.value('', _('未设置'));
		for (var i = 0; i < providers.length; i++) {
			var sid = providers[i]['.name'];
			o.value(sid, providers[i].name || sid);
		}

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

		o = s.option(form.Button, '_preview_modal', _('配置预览'));
		o.modalonly = true;
		o.inputtitle = _('查看预览');
		o.inputstyle = 'neutral';
		o.onclick = L.bind(function(section_id) {
			return this.handlePreview(m, section_id);
		}, this);

		o = s.option(form.Button, '_test_modal', _('供应商测试'));
		o.modalonly = true;
		o.inputtitle = _('测试连接');
		o.inputstyle = 'neutral';
		o.onclick = L.bind(function(section_id) {
			return this.handleTest(m, section_id);
		}, this);

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
