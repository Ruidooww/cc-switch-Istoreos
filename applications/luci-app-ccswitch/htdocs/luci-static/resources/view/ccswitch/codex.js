'use strict';
'require form';
'require rpc';
'require ui';
'require uci';
'require view';

function sectionFromArgs(args) {
	for (var i = 0; i < args.length; i++) {
		if (typeof args[i] === 'string' && /^[A-Za-z0-9_]+$/.test(args[i]))
			return args[i];
	}
	return '';
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
			L.resolveDefault(this.callStatus('codex'), {})
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

	checkSection: function(section_id) {
		if (typeof section_id === 'string' && /^[A-Za-z0-9_]+$/.test(section_id))
			return section_id;

		ui.addNotification(null, E('p', {}, _('供应商记录还没有准备好，请先保存页面后再操作。')), 'danger');
		return null;
	},

	showApplyPreview: function(section_id, preview) {
		var name = uci.get('ccswitch', section_id, 'name') || section_id;

		ui.showModal(_('启用前预览') + ' - ' + name, [
			E('p', {}, _('确认后会备份当前 Codex 配置，并写入下面的内容。API Key 已打码。')),
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
						return this.callApply('codex', section_id)
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
		section_id = this.checkSection(section_id);
		if (!section_id)
			return Promise.resolve();

		uci.set('ccswitch', section_id, 'enabled', '1');

		return map.save()
			.then(L.bind(function() {
				return this.callPreview('codex', section_id);
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
		section_id = this.checkSection(section_id);
		if (!section_id)
			return Promise.resolve();

		return map.save()
			.then(L.bind(function() {
				return this.callPreview('codex', section_id);
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
		section_id = this.checkSection(section_id);
		if (!section_id)
			return Promise.resolve();

		return map.save()
			.then(L.bind(function() {
				return this.callTest('codex', section_id);
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
		section_id = this.checkSection(section_id);
		if (!section_id)
			return Promise.resolve();

		return map.save()
			.then(L.bind(function() {
				return this.callClone('codex', section_id);
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
		section_id = this.checkSection(section_id);
		if (!section_id)
			return Promise.resolve();

		return map.save()
			.then(L.bind(function() {
				return this.callFailover('codex', section_id);
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
		var providers = uci.sections('ccswitch', 'codex_provider');
		var m, s, o;

		m = new form.Map('ccswitch', _('CC Switch - Codex'),
			_('管理 Codex CLI API 供应商，并把当前启用的供应商写入 root 用户配置。'));

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

		o = s.option(form.ListValue, 'fallback_provider', _('备用供应商'));
		o.modalonly = true;
		o.rmempty = true;
		o.value('', _('未设置'));
		for (var i = 0; i < providers.length; i++) {
			var sid = providers[i]['.name'];
			o.value(sid, providers[i].name || sid);
		}

		o = s.option(form.Button, '_preview_modal', _('配置预览'));
		o.modalonly = true;
		o.inputtitle = _('查看预览');
		o.inputstyle = 'neutral';
		o.onclick = L.bind(function() {
			var section_id = sectionFromArgs(arguments);
			return this.handlePreview(m, section_id);
		}, this);

		o = s.option(form.Button, '_test_modal', _('供应商测试'));
		o.modalonly = true;
		o.inputtitle = _('测试连接');
		o.inputstyle = 'neutral';
		o.onclick = L.bind(function() {
			var section_id = sectionFromArgs(arguments);
			return this.handleTest(m, section_id);
		}, this);

		o = s.option(form.Value, 'notes', _('备注'));
		o.modalonly = true;
		o.rmempty = true;

		o = s.option(form.Button, '_apply_modal', _('保存并启用'));
		o.modalonly = true;
		o.inputtitle = _('保存并启用');
		o.inputstyle = 'apply';
		o.onclick = L.bind(function() {
			var section_id = sectionFromArgs(arguments);
			return this.handleApply(m, section_id);
		}, this);

		return m.render();
	}
});
