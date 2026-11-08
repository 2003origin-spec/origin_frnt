---
title: "Ray Optics: Formula Sheet"
type: formula_sheet
chapter: c12.physics.ray-optics-and-optical-instruments
order: 1
---

:::remember
**Sign convention used everywhere here: NCERT's Cartesian sign convention.**
- Measure every distance from the **pole** (mirror) or **optical centre** (lens), along the principal axis.
- Distances in the **same direction as the incident light** are **positive**. Distances against it are **negative**.
- Heights **above** the principal axis are positive, heights **below** are negative.

With light going left to right, a real object is at $u < 0$. A concave mirror has $f < 0$, a convex mirror $f > 0$. A convex lens has $f > 0$, a concave lens $f < 0$. Never mix this with the older "real is positive" rule.

The magnifying powers of microscopes and telescopes at the end are quoted as **positive sizes**, as NCERT does, even where the final image is inverted.
:::

## Reflection by spherical mirrors

:::formula{title="Focal length of a spherical mirror"}
$$f = \frac{R}{2}$$
$R$ = radius of curvature, $f$ = focal length (m or cm). Holds for **paraxial rays**: rays close to the pole and at small angles to the axis.
:::

:::formula{title="Mirror equation"}
$$\frac{1}{v} + \frac{1}{u} = \frac{1}{f}$$
$u$ = object distance, $v$ = image distance. Valid for concave and convex mirrors, real and virtual images, with signs put in. Paraxial rays only.
:::

:::formula{title="Magnification by a mirror"}
$$m = \frac{h'}{h} = -\frac{v}{u}$$
$h$ = object height, $h'$ = image height. $m < 0$: real and inverted. $m > 0$: virtual and erect. $|m| > 1$: enlarged.
:::

## Refraction at a plane surface

:::formula{title="Snell's law"}
$$\frac{\sin i}{\sin r} = n_{21}$$
$$n_1\sin i = n_2\sin r$$
$i$, $r$ = angles with the **normal**. $n_{21}$ = refractive index of medium 2 with respect to medium 1 (no unit). It depends on the pair of media and on the wavelength, not on $i$.
:::

:::formula{title="Relative refractive indices"}
$$n_{21} = \frac{n_2}{n_1} = \frac{v_1}{v_2}$$
$$n_{12} = \frac{1}{n_{21}}$$
$$n_{32} = n_{31} \times n_{12}$$
$v_1$, $v_2$ = speeds of light in the two media. $n_{21} > 1$: the ray bends **towards** the normal (medium 2 is optically denser).
:::

:::formula{title="Apparent depth"}
$$h_{apparent} = \frac{h_{real}}{n}$$
Object in a medium of index $n$, seen from air **nearly along the normal**. The object seems raised by $h_{real}\left(1 - \dfrac{1}{n}\right)$.
:::

## Total internal reflection

:::formula{title="Critical angle"}
$$\sin i_c = \frac{1}{n_{12}}$$
$n_{12}$ = index of the denser medium 1 with respect to the rarer medium 2. From a medium of index $n$ into air: $\sin i_c = 1/n$.

TIR needs both: light going from **denser to rarer**, and $i > i_c$.
:::

## Refraction at a spherical surface

:::formula{title="Single spherical surface"}
$$\frac{n_2}{v} - \frac{n_1}{u} = \frac{n_2 - n_1}{R}$$
Light goes from medium $n_1$ into medium $n_2$. $R$ is positive if the centre of curvature is on the side the light goes to (the $n_2$ side). Paraxial rays only.
:::

## Thin lenses

:::formula{title="Lens maker's formula"}
$$\frac{1}{f} = (n_{21} - 1)\left(\frac{1}{R_1} - \frac{1}{R_2}\right)$$
$n_{21} = n_2/n_1$: lens index $n_2$ over surrounding index $n_1$. $R_1$, $R_2$ = radii of the first and second surfaces met by the light, with signs. Equiconvex lens: $R_1 = +R$, $R_2 = -R$.
:::

:::formula{title="Thin lens formula"}
$$\frac{1}{v} - \frac{1}{u} = \frac{1}{f}$$
Valid for thin convex and concave lenses, real and virtual images, with signs put in (paraxial rays). Note the **minus** sign (the mirror equation has plus).
:::

:::formula{title="Magnification by a lens"}
$$m = \frac{h'}{h} = \frac{v}{u}$$
No minus sign for a lens. $m < 0$: real, inverted. $m > 0$: virtual, erect.
:::

:::formula{title="Power of a lens"}
$$P = \frac{1}{f}$$
$f$ in **metres**, $P$ in dioptre (D); $1\text{ D} = 1\text{ m}^{-1}$. Convex (converging): $P > 0$. Concave (diverging): $P < 0$. With $f$ in cm: $P = 100/f$.
:::

:::formula{title="Thin lenses in contact"}
$$\frac{1}{f} = \frac{1}{f_1} + \frac{1}{f_2} + \frac{1}{f_3} + \dots$$
$$P = P_1 + P_2 + P_3 + \dots$$
$$m = m_1 m_2 m_3 \dots$$
Algebraic sums: a concave lens adds a negative power. Lenses must be **thin and touching**.
:::

## Prism

$A$ = angle of the prism, $i$ = angle of incidence, $e$ = angle of emergence, $r_1$, $r_2$ = angles inside the prism, $\delta$ = deviation.

:::formula{title="Angles inside a prism"}
$$r_1 + r_2 = A$$
$$\delta = i + e - A$$
:::

:::formula{title="Minimum deviation"}
$$n_{21} = \frac{\sin\left[(A + D_m)/2\right]}{\sin(A/2)}$$
At minimum deviation $D_m$: $i = e$, $r_1 = r_2 = A/2$, the ray inside is parallel to the base, and $i = (A + D_m)/2$.
:::

:::formula{title="Thin prism"}
$$D_m = (n_{21} - 1)A$$
Only for a **small** prism angle $A$ (a few degrees).
:::

## Optical instruments

$D$ = least distance of distinct vision (near point) $\approx 25$ cm.

:::formula{title="Simple microscope"}
Image at the near point:
$$m = 1 + \frac{D}{f}$$
Image at infinity (relaxed eye):
$$m = \frac{D}{f}$$
$f$ = focal length of the convex lens. The second is smaller by exactly 1.
:::

:::formula{title="Compound microscope"}
$$m = m_o m_e$$
$$m_o = \frac{L}{f_o}$$
Eyepiece: $m_e = 1 + \dfrac{D}{f_e}$ (image at near point) or $\dfrac{D}{f_e}$ (image at infinity). With the image at infinity:
$$m \approx \frac{L}{f_o}\cdot\frac{D}{f_e}$$
$L$ = **tube length**: distance between the second focal point of the objective and the first focal point of the eyepiece (not the lens separation). NCERT gives these as positive numbers; the final image is in fact inverted.
:::

:::formula{title="Astronomical telescope (normal adjustment)"}
$$m = \frac{\beta}{\alpha} = \frac{f_o}{f_e}$$
$$\text{tube length} = f_o + f_e$$
$\alpha$ = angle the object subtends, $\beta$ = angle the final image subtends at the eye. Final image at infinity. NCERT takes $m$ as positive; the final image is inverted. For a reflecting telescope, $f_o = R/2$ of the objective mirror.
:::

## Exam extras (beyond the NCERT text)

:::formula{title="Lateral shift through a glass slab"}
$$d = \frac{t\,\sin(i - r)}{\cos r}$$
$t$ = slab thickness, $i$ and $r$ = angles at the first face; same medium (air) on both sides. NCERT names the lateral shift but gives no formula (exam extra: refraction at plane surfaces is in both syllabi).
:::

:::formula{title="Telescope with final image at the near point"}
$$m = \frac{f_o}{f_e}\left(1 + \frac{f_e}{D}\right)$$
Magnitude, final image at $D$. Exam extra: both syllabi list the telescope's magnifying power; NCERT Exercise 9.27(b) asks for this case, but the text does not derive it.
:::

:::formula{title="Displacement method (convex lens)"}
$$f = \frac{s^2 - x^2}{4s}$$
$s$ = fixed object–screen distance, $x$ = distance between the two lens positions that give a sharp image. Two sharp positions exist only if $s > 4f$ (at $s = 4f$ they merge, $x = 0$); $4f$ is the least object–real image distance. Exam extra: it follows from the thin lens formula (in both syllabi); NCERT Exercises 9.18 and 9.19 use the idea.
:::

:::formula{title="Two thin lenses a distance d apart"}
$$\frac{1}{F} = \frac{1}{f_1} + \frac{1}{f_2} - \frac{d}{f_1 f_2}$$
Thin lenses in air, $d$ = distance between them. $F$ is **not** measured from either lens, so to find an image, trace it lens by lens (as in NCERT Example 9.8). For $d = 0$ it becomes the lenses-in-contact formula. Beyond the syllabus: both syllabi list only lenses **in contact**; shown as an aid for NCERT Exercise 9.20.
:::

:::formula{title="Speed of the image along the axis"}
$$|v_{image}| = m^2\,|v_{object}|$$
Object moving along the axis, $m$ = magnification at that instant. A **mirror's** image moves **opposite** to the object along the axis; a **lens's** image moves the **same** way. Explains why the image in NCERT Example 9.4 (the jogger in the side mirror) speeds up. Exam extra: it follows from the mirror and lens formulas (in both syllabi); not in NCERT.
:::
