#!/bin/sh
# Re-shoot every deliverable page at 1440 and 390 into design/shots/<round>/
R=${1:-final}; O=shots/$R
./shot.sh landing/index.html $O --viewports desktop,phone --wait 8800 --full --name landing
for s in ridge-roast spoke-and-chain barro-studio; do ./shot.sh "storefront/index.html?b=$s" $O --viewports desktop,phone --wait 2500 --full --name storefront-$s; done
./shot.sh "storefront/index.html?b=ridge-roast&state=draft" $O --viewports desktop,phone --wait 2500 --full --name storefront-draft-ridge-roast
./shot.sh "storefront/index.html?b=barro-studio&state=draft" $O --viewports desktop,phone --wait 2500 --full --name storefront-draft-barro-studio
./shot.sh brand/index.html $O --viewports desktop,phone --wait 1500 --full --name brand-sheet
cd ../$O && for f in *.png; do n=$(echo $f | sed -E 's/-127\.0\.0\.1-8787-[a-z/.-]*index\.html__/-/; s/desktop/1440/; s/phone/390/'); [ "$f" != "$n" ] && mv -f "$f" "$n"; done; rm -f index.json
