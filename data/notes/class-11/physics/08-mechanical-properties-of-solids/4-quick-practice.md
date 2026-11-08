---
title: "Mechanical Properties of Solids: Quick Practice"
type: practice
chapter: c11.physics.mechanical-properties-of-solids
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Young's modulus

:::question{title="1. Stretch of a wire" exam="NEET level"}
A steel wire 2 m long, with cross-sectional area 1 mm², carries a tension of 100 N. $Y = 2\times10^{11}$ N m⁻². Find its extension.

---

$\Delta L = \dfrac{FL}{AY} = \dfrac{100 \times 2}{10^{-6}\times 2\times10^{11}} = \dfrac{200}{2\times10^{5}} = 10^{-3}$ m $=$ **1 mm**.
:::

:::question{title="2. Longer and thicker" exam="NEET level"}
Wire P has length $L$ and radius $r$. Wire Q, of the same material, has length $2L$ and radius $2r$. Both carry the same load. Find the ratio of their extensions, $\Delta L_P : \Delta L_Q$.

---

$\Delta L \propto \dfrac{L}{r^2}$. P: $\dfrac{L}{r^2}$. Q: $\dfrac{2L}{4r^2} = \dfrac{L}{2r^2}$. So $\Delta L_P : \Delta L_Q =$ **2 : 1**.
:::

:::question{title="3. Wires in series" exam="NEET level"}
A steel wire and a copper wire of the same length and same cross-section are joined end to end and stretched by a load. Take $Y_{steel} = 2.0\times10^{11}$ Pa and $Y_{copper} = 1.0\times10^{11}$ Pa. Find the ratio of (a) their stresses and (b) their extensions, steel : copper.

---

(a) Both carry the same tension over the same area, so the stresses are equal: **1 : 1**.

(b) $\Delta L = \dfrac{\text{stress}\times L}{Y}$ with the same stress and $L$, so $\Delta L \propto \dfrac1Y$. Steel : copper $= \dfrac{1}{2} : 1 =$ **1 : 2**.
:::

## Shear and bulk modulus

:::question{title="4. Sheared cube" exam="NEET level"}
An aluminium cube of edge 10 cm has its bottom face fixed. A tangential force of $5\times10^4$ N acts on its top face. Shear modulus $G = 2.5\times10^{10}$ Pa. How far does the top face shift?

---

Area of the top face $= 0.1 \times 0.1 = 0.01$ m². Shearing stress $= \dfrac{5\times10^4}{0.01} = 5\times10^6$ Pa.

$\theta = \dfrac{5\times10^6}{2.5\times10^{10}} = 2\times10^{-4}$ rad. Shift $\Delta x = \theta L = 2\times10^{-4}\times0.1 = 2\times10^{-5}$ m $=$ **0.02 mm**.
:::

:::question{title="5. Squeezed steel ball" exam="NEET level"}
A steel ball of volume $1.0\times10^{-3}$ m³ is put under an extra pressure of $8\times10^7$ Pa. Bulk modulus of steel $= 1.6\times10^{11}$ Pa. Find the decrease in its volume.

---

$|\Delta V| = \dfrac{pV}{B} = \dfrac{8\times10^7\times10^{-3}}{1.6\times10^{11}} = 5\times10^{-7}$ m³ $=$ **0.5 cm³**.
:::

:::question{title="6. Shrinking radius" exam="JEE Main level"}
An iron sphere ($B = 1.0\times10^{11}$ Pa) is put under an extra pressure of $1.2\times10^8$ Pa. By what percentage does its radius decrease?

---

Volume strain $= \dfrac{p}{B} = \dfrac{1.2\times10^8}{10^{11}} = 1.2\times10^{-3}$.

$V \propto r^3$, so for small changes $\dfrac{\Delta V}{V} = 3\,\dfrac{\Delta r}{r}$. Then $\dfrac{\Delta r}{r} = 4\times10^{-4}$, a decrease of **0.04%**.
:::

## Energy, Poisson's ratio and applications

:::question{title="7. Stored energy" exam="NEET level"}
A wire 2 m long with cross-sectional area 2 mm² is stretched by 1 mm. $Y = 2\times10^{11}$ Pa. Find the elastic potential energy stored.

---

$\dfrac{YA}{L} = \dfrac{2\times10^{11}\times2\times10^{-6}}{2} = 2\times10^5$ N/m.

$U = \dfrac12\,\dfrac{YA}{L}\,l^2 = \dfrac12\times2\times10^5\times(10^{-3})^2 =$ **0.1 J**.
:::

:::question{title="8. Thinner but bigger" exam="JEE Main level"}
A wire is stretched so that its longitudinal strain is $2\times10^{-3}$. Its Poisson's ratio is 0.3. Find the percentage change in (a) its diameter and (b) its volume.

---

(a) Lateral strain $= 0.3\times2\times10^{-3} = 6\times10^{-4}$: the diameter **decreases by 0.06%**.

(b) $V = \dfrac{\pi d^2}{4}L$, so $\dfrac{\Delta V}{V} = \dfrac{\Delta L}{L} - 2\,\dfrac{\Delta d}{d} = 2\times10^{-3} - 1.2\times10^{-3} = 8\times10^{-4}$. The volume **increases by 0.08%**.
:::

:::question{title="9. Rope with a safety factor" exam="NEET level"}
A steel rope must lift 500 kg. Yield strength of steel $= 2.5\times10^8$ Pa. The rope is designed for **10 times** the load, as a safety margin. Find its least radius.

---

Design load $= 10\times500\times10 = 5\times10^4$ N. Area $A \ge \dfrac{5\times10^4}{2.5\times10^8} = 2\times10^{-4}$ m².

$r = \sqrt{\dfrac{A}{\pi}} = \sqrt{\dfrac{2\times10^{-4}}{3.14}} \approx$ **8 mm**.
:::

:::question{title="10. Turning a beam on its side" exam="JEE Main level"}
A rectangular beam, 4 cm wide and 2 cm deep, is supported at its ends and loaded at the centre. It is then turned so that it is 2 cm wide and 4 cm deep, with the same load and span. What happens to its sag?

---

$\delta = \dfrac{Wl^3}{4bd^3Y}$, so $\delta \propto \dfrac{1}{bd^3}$.

First: $bd^3 = 4\times2^3 = 32$. Turned: $bd^3 = 2\times4^3 = 128$. The sag becomes $\dfrac{32}{128}$, that is **one-fourth** of before.
:::
