---
title: "Ray Optics: Short Notes"
type: short_notes
chapter: c12.physics.ray-optics-and-optical-instruments
order: 2
---

## 1. The ray picture of light

- Visible light: wavelength about **400 nm to 750 nm**. Speed in vacuum $c \approx 3 \times 10^8$ m/s, the highest speed in nature.
- The wavelength is tiny compared with everyday objects, so light can be treated as moving in **straight lines**. Such a path is a **ray**; a bundle of rays is a **beam**.
- This chapter uses rays to study reflection, refraction, image formation and optical instruments.

## 2. Reflection by spherical mirrors

**Laws of reflection:** angle of reflection = angle of incidence, and the incident ray, reflected ray and normal lie in one plane. They hold at every point of any surface, flat or curved. For a spherical mirror, the normal at a point is along the radius (through the centre of curvature $C$).

- **Pole (P):** centre of the mirror. **Principal axis:** line through P and C.
- **Paraxial rays:** rays close to the pole, at small angles to the axis. All the formulas assume them.
- **Principal focus (F):** where a parallel paraxial beam meets after reflection (concave) or seems to come from (convex). $f = R/2$.
- **Focal plane:** a parallel beam at an angle to the axis focuses on the plane through F, normal to the axis.
- **Real image:** rays actually meet; can be caught on a screen. **Virtual image:** rays only seem to come from it.

**Rays used in ray diagrams (any two):**
1. Parallel to the axis → reflects through F (or seems to come from F, convex).
2. Through C (or towards C, convex) → comes straight back.
3. Through F (or towards F, convex) → reflects parallel to the axis.
4. At the pole → reflects by the law of reflection, symmetric about the axis.

## 3. The Cartesian sign convention

- Measure distances from the pole or optical centre.
- Along the incident light: **+**. Against it: **−**.
- Heights above the axis **+**, below **−**.

With one convention, a single mirror equation and a single lens formula cover every case.

## 4. Mirror equation and images

$$\frac{1}{v} + \frac{1}{u} = \frac{1}{f}$$
$$m = -\frac{v}{u}$$

**Concave mirror** (object in front, real):

| Object at | Image at | Nature |
| --- | --- | --- |
| Infinity | F | Real, inverted, point-size |
| Beyond C | Between F and C | Real, inverted, smaller |
| C | C | Real, inverted, same size |
| Between C and F | Beyond C | Real, inverted, bigger |
| F | Infinity | Real, inverted, very large |
| Between F and P | Behind the mirror | Virtual, erect, bigger |

**Convex mirror:** for any real object the image is **virtual, erect, smaller**, between P and F behind the mirror. That is why it is used as a rear-view (side) mirror: it shows a wide field.

:::example{title="NCERT-type: concave mirror"}
$R = 15$ cm, so $f = -7.5$ cm. Object at $u = -10$ cm: $\dfrac{1}{v} = -\dfrac{1}{7.5} + \dfrac{1}{10}$, so $v = -30$ cm. $m = -\dfrac{v}{u} = -3$: real, inverted, 3 times bigger.
:::

- Covering half of a mirror (or lens) still gives the **whole** image, only less bright (NCERT Example 9.1).
- An object lying **along** the axis gives a distorted image: different parts are magnified differently (NCERT Example 9.2).

## 5. Refraction

**Snell's laws:** the incident ray, refracted ray and normal lie in one plane, and $\dfrac{\sin i}{\sin r} = n_{21}$, a constant for the pair of media (it depends on wavelength, not on $i$).

- $n_{21} > 1$: the ray bends **towards** the normal; medium 2 is optically **denser**.
- $n_{21} < 1$: the ray bends **away** from the normal (denser to rarer).
- $n_{12} = 1/n_{21}$, and $n_{32} = n_{31} \times n_{12}$.
- **Optical density is not mass density.** Turpentine is lighter than water but optically denser.

**Glass slab:** the emergent ray is **parallel** to the incident ray (no deviation), but shifted sideways (**lateral shift**).

**Apparent depth:** a tank bottom looks raised. Seen nearly along the normal, apparent depth = real depth $/\,n$.

## 6. Total internal reflection (TIR)

Going from denser to rarer, the refracted ray bends away from the normal. As $i$ grows, $r$ reaches $90^\circ$ (the ray grazes the surface). That $i$ is the **critical angle** $i_c$. For $i > i_c$ there is no refracted ray at all: **all** the light is reflected.

Ordinary reflection always loses some light to transmission; TIR loses none.

| Medium | $n$ | $i_c$ |
| --- | --- | --- |
| Water | 1.33 | 48.75° |
| Crown glass | 1.52 | 41.14° |
| Dense flint glass | 1.62 | 37.31° |
| Diamond | 2.42 | 24.41° |

**Uses and examples:**
- **Totally reflecting prisms** turn rays by $90^\circ$ or $180^\circ$, or invert an image without changing its size. This needs $i_c < 45^\circ$, true for crown and flint glass.
- **Optical fibres:** a glass or quartz **core** of higher $n$ inside a **cladding** of lower $n$. Light goes along by repeated TIR, even round bends, with little loss (silica fibres pass over 95% of the light over 1 km). Used for signals and for looking inside the body (endoscopy).
- **Mirage** and the **sparkle of diamond** (small $i_c$, many internal reflections).

## 7. Refraction at a spherical surface

$$\frac{n_2}{v} - \frac{n_1}{u} = \frac{n_2 - n_1}{R}$$

Light goes from $n_1$ to $n_2$; paraxial rays. Every lens formula is built from this, one surface at a time.

## 8. Thin lenses

Applying the surface formula to both faces of a thin lens gives:

$$\frac{1}{f} = (n_{21} - 1)\left(\frac{1}{R_1} - \frac{1}{R_2}\right)$$
$$\frac{1}{v} - \frac{1}{u} = \frac{1}{f}$$
$$m = \frac{v}{u}$$

- A lens has **two foci**, equally far from the optical centre on the two sides: the first focus F (on the side light comes from) and the second focus F′.
- For a glass lens in air: convex lens $R_1 > 0$, $R_2 < 0$, so $f > 0$; concave lens $R_1 < 0$, $R_2 > 0$, so $f < 0$.
- If the lens and the liquid around it have the **same** $n$, then $1/f = 0$: the lens "disappears" (NCERT Example 9.6).
- In a liquid of higher $n$ (but still below the glass) a glass lens gets a **longer** focal length (NCERT Example 9.7: 20 cm in air, about 78 cm in water).

**Ray rules for lenses:**
1. Parallel to the axis → through F′ (convex), or seems to come from F (concave).
2. Through the optical centre → goes straight on.
3. Through F (convex), or heading for F′ (concave) → comes out parallel to the axis.

**Convex lens images:** object beyond $2f$ → real, smaller; at $2f$ → real, same size at $2f$; between $f$ and $2f$ → real, bigger, beyond $2f$; inside $f$ → virtual, erect, bigger (magnifying glass). **Concave lens** (real object): always virtual, erect, smaller.

**Power** $P = 1/f$ (in metres), unit dioptre. +2.5 D is a convex lens of $f = +40$ cm; −4 D is a concave lens of $f = -25$ cm.

**Lenses in contact:** powers add, $P = P_1 + P_2 + \dots$ (with signs), and magnifications multiply. Combinations are used in cameras, microscopes and telescopes.

:::remember
In a lens system, the image from the first lens acts as the object for the next. If that image lies beyond the next lens, it is a **virtual object** for it (rays converge towards it), and $u$ is positive.
:::

## 9. Refraction through a prism

A ray enters face AB at angle $i$ and leaves face AC at angle $e$. The angle between the incident and emergent rays is the **deviation** $\delta$.

- $r_1 + r_2 = A$ and $\delta = i + e - A$.
- The $\delta$–$i$ graph falls, reaches a **minimum** $D_m$, then rises. Any other $\delta$ comes from two values of $i$ (the path can be reversed, swapping $i$ and $e$).
- At **minimum deviation**: $i = e$, $r_1 = r_2 = A/2$, and the ray inside runs **parallel to the base**. Measuring $A$ and $D_m$ gives $n$.
- A **thin prism** deviates light only a little: $D_m = (n_{21} - 1)A$.
- **Dispersion** is the splitting of white light into its colours, because $n$ depends on wavelength (NCERT summary line; the dispersion section is no longer in the book).

## 10. Optical instruments

**Simple microscope (magnifying glass):** a convex lens of short focal length, held with the object at or just inside $f$, the eye close to the lens.
- Image at the near point $D$ (25 cm): $m = 1 + D/f$. Example: $f = 5$ cm gives $m = 6$.
- Image at infinity (relaxed eye, more comfortable): $m = D/f$, one less.
- It works because the object can be brought much closer than 25 cm, so it subtends a bigger angle. Realistic limit: $m \le 9$.

**Compound microscope:** the **objective** (short $f_o$, near the object) makes a real, inverted, magnified image near the focus of the **eyepiece**. The eyepiece acts as a simple microscope. The final image is virtual and **inverted** relative to the object.
- $m = m_o m_e$, with $m_o = L/f_o$; image at infinity: $m \approx \dfrac{L}{f_o}\cdot\dfrac{D}{f_e}$.
- Both lenses need **short** focal lengths. NCERT example: $f_o = 1$ cm, $f_e = 2$ cm, $L = 20$ cm gives $m = 250$.

**Refracting (astronomical) telescope:** objective of **large focal length and large aperture**; real image at its focal point, magnified by the eyepiece. Final image inverted.
- $m = f_o/f_e$ in normal adjustment; tube length $f_o + f_e$.
- **Light-gathering power** depends on the objective's area; **resolving power** also grows with its diameter.
- **Terrestrial telescopes** add a pair of inverting lenses for an erect image.

**Reflecting telescope:** a concave mirror as the objective.
- No chromatic aberration; a mirror is lighter than an equal lens and can be supported over its whole back.
- **Cassegrain:** a convex secondary mirror sends the light through a hole in the primary. Large focal length in a short tube.

| | Microscope | Telescope |
| --- | --- | --- |
| Views | Small, near objects | Distant objects |
| Objective | Short $f$, small aperture | Long $f$, large aperture |
| Magnifies | Size (by $m_o$) then angle | Angle only |
