# luci-app-ccswitch

iStoreOS / OpenWrt 的 LuCI 插件，提供 Claude / Codex API 代理服务与可视化 Web 管理界面，支持 API 提供商切换、用量统计及代理链路状态监控。

## 功能

- API 提供商切换：在 LuCI 页面中切换 Claude / Codex 请求的上游服务
- 本地反向代理：通过 uhttpd 在路由器上启动代理进程，转发 API 请求
- 用量追踪与记录：自动记录每次请求的 token 消耗到本地日志
- 代理状态监控：Web 页面实时查看代理运行状态，支持一键启停
- 超时与重试控制：可配置上游超时、连接保留等参数

## 目录结构

```
applications/luci-app-ccswitch/
  htdocs/luci-static/resources/view/ccswitch/   # 前端 JS (LuCI view)
  root/etc/config/ccswitch                       # UCI 配置文件
  root/etc/init.d/ccswitch-proxy                 # procd 服务脚本
  root/etc/uci-defaults/                         # 默认配置
  root/usr/libexec/ccswitch-proxy-cgi             # 代理 CGI 后端
  root/usr/libexec/rpcd/ccswitch                  # rpcd 插件
  root/usr/share/ccswitch/proxy-www/             # 代理端点 (health, /v1/*)
  root/usr/share/luci/menu.d/                    # LuCI 菜单注册
  root/usr/share/rpcd/acl.d/                     # rpcd ACL 权限
  po/zh_Hans/ccswitch.po                         # 中文翻译
  Makefile                                        # OpenWrt 构建规则
dist/                                             # 预构建 IPK 包
scripts/build-luci-app-ccswitch-ipk.mjs           # IPK 打包脚本
```

## 依赖

- luci-base
- rpcd
- jsonfilter
- uhttpd
- curl

## 构建

需要 OpenWrt / iStoreOS SDK 环境。将 `luci-app-ccswitch` 放入 `package/` 目录后：

```bash
make menuconfig
# LuCI → Applications → 选中 luci-app-ccswitch
make package/luci-app-ccswitch/compile
```

或者使用 Node.js 脚本直接打包 IPK（无需 OpenWrt SDK）：

```bash
node scripts/build-luci-app-ccswitch-ipk.mjs
```

生成的 IPK 包位于 `dist/luci-app-ccswitch_<version>_all.ipk`，上传到路由器后执行：

```bash
opkg install luci-app-ccswitch_*.ipk
```

## 代理服务

安装后代理默认监听 `127.0.0.1:15721`，通过 `/etc/config/ccswitch` 可配置端口与上游地址。

```bash
# 查看状态
/etc/init.d/ccswitch-proxy status

# 启停
/etc/init.d/ccswitch-proxy start
/etc/init.d/ccswitch-proxy stop
```

## 版本

当前版本：**1.5.2-1**

## 许可

Apache License 2.0
