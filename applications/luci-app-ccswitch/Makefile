# Copyright (C) 2026
#
# This is free software, licensed under the Apache License, Version 2.0.

include $(TOPDIR)/rules.mk

PKG_VERSION:=1.5.5
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Codex

LUCI_TITLE:=LuCI support for CC Switch provider switching
LUCI_DEPENDS:=+luci-base +rpcd +jsonfilter +uhttpd +curl
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
