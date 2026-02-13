# Maintainer: Joe George <joegeorge1123@gmail.com>
pkgname=aerotop
pkgver=1.0.0
pkgrel=1
pkgdesc="A high-performance skinnable system monitor with a Frutiger Aero aesthetic."
arch=('x86_64')
url="https://github.com/joe-george-1/aerotop"
license=('MIT')
depends=('nss' 'atk' 'at-spi2-atk' 'libdrm' 'libpulse' 'mesa')
makedepends=('npm' 'nodejs')
source=("${pkgname}-${pkgver}.tar.gz::${url}/archive/v${pkgver}.tar.gz")
sha256sums=('SKIP') # Replace with actual hash for release

build() {
  cd "${pkgname}-${pkgver}"
  npm install
  npm run build:linux
}

package() {
  cd "${pkgname}-${pkgver}"
  install -Dm755 "dist/Aerotop-1.0.0.AppImage" "${pkgdir}/usr/bin/${pkgname}"
  
  # Desktop entry
  install -Dm644 "build/icon.png" "${pkgdir}/usr/share/icons/hicolor/1024x1024/apps/${pkgname}.png"
}
