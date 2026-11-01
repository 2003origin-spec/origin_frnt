---
title: "Electromagnetic Waves: Short Notes"
type: short_notes
chapter: c12.physics.electromagnetic-waves
order: 2
---

## 1. The problem with Ampere's law

- A changing magnetic field makes an electric field (Faraday, Chapter 6). Maxwell asked: does a changing **electric** field make a magnetic field? Yes.
- Take a capacitor being charged by a current $i(t)$. Draw a circular loop around the wire, at a point P just outside the capacitor.
- Ampere's law with a **flat** surface on the loop: the wire passes through it, so $B(2\pi r) = \mu_0 i$.
- Now stretch the surface into a **pot** (or a tiffin box without a lid) whose bottom sits between the plates. Same loop, but no current passes through this surface, so Ampere's law gives $B = 0$.
- Same loop, two answers: Ampere's law is missing a term.

## 2. Displacement current

The missing thing between the plates is the **changing electric field**. The flux there is $\Phi_E = Q/\varepsilon_0$, so
$$\varepsilon_0\frac{d\Phi_E}{dt} = \frac{dQ}{dt} = i$$

Maxwell called $i_d = \varepsilon_0\,d\Phi_E/dt$ the **displacement current**. Add it to the conduction current and both surfaces give the same $B$.

| | Conduction current $i_c$ | Displacement current $i_d$ |
| --- | --- | --- |
| Due to | Moving charges | Changing electric field |
| Where (charging capacitor) | In the wires | Between the plates |
| Makes a magnetic field? | Yes | Yes, in exactly the same way |

- In a charging capacitor, $i_c$ in the wire **equals** $i_d$ between the plates.
- A steady field (for example the steady field inside a wire carrying DC) gives $i_d = 0$.
- In real materials both can exist in the same region, since nothing is a perfect conductor or a perfect insulator.
- In empty space there can be a magnetic field with **no** conduction current nearby, made only by a changing electric field.
- Check by experiment: $B$ measured at M, between the plates, equals $B$ just outside at P.

:::remember
Ampere–Maxwell law:
$$\begin{aligned} \oint \vec B\cdot d\vec l &= \mu_0 i_c \\ &\quad + \mu_0\varepsilon_0\frac{d\Phi_E}{dt} \end{aligned}$$
The source of a magnetic field is the conduction current **plus** the rate of change of electric flux.
:::

## 3. Maxwell's equations

Four laws (in vacuum) plus the Lorentz force describe all of electromagnetism:
1. Gauss's law for electricity: $\oint \vec E\cdot d\vec A = Q/\varepsilon_0$.
2. Gauss's law for magnetism: $\oint \vec B\cdot d\vec A = 0$.
3. Faraday's law: $\oint \vec E\cdot d\vec l = -d\Phi_B/dt$.
4. Ampere–Maxwell law.

With displacement current the laws become more **symmetric**: a changing $\vec B$ makes $\vec E$, and a changing $\vec E$ makes $\vec B$. They are still not fully symmetric, because no magnetic monopoles are known. The most important result of this symmetry is the existence of **electromagnetic waves**.

## 4. Sources of EM waves

- A charge at **rest** gives only a static electric field. A charge moving at **constant velocity** (a steady current) gives a magnetic field that does not change. Neither radiates.
- **Accelerated charges radiate** EM waves. An oscillating charge is accelerated. Its changing $\vec E$ makes a changing $\vec B$, which makes a changing $\vec E$, and so on: the fields keep each other going as the wave travels.
- The wave's frequency **equals** the frequency of the oscillating charge. The wave's energy comes from the source.
- An oscillating electric dipole is a basic source.
- A transmitting antenna radiates best at wavelengths about the **same size** as the antenna.

**Why not test with an AC circuit?** Yellow light is about $6 \times 10^{14}$ Hz, but electronic circuits reach only about $10^{11}$ Hz. So the first tests used radio waves.

| Who | What |
| --- | --- |
| Hertz (1887) | First made and detected EM waves in the lab (wavelength of a few metres) |
| J. C. Bose (Kolkata) | Seven years after Hertz: much shorter waves, 25 mm to 5 mm |
| Marconi (Italy) | Sent EM waves over many kilometres; start of radio communication |

## 5. Nature of EM waves

Take a wave moving along $+z$:
$$E_x = E_0\sin(kz - \omega t)$$
$$B_y = B_0\sin(kz - \omega t)$$

- **Transverse:** $\vec E$, $\vec B$ and the direction of travel are mutually perpendicular. The wave travels along $\vec E \times \vec B$.
- $\vec E$ and $\vec B$ are **in phase**: both peak and both are zero at the same places and times.
- $B_0 = E_0/c$, and $c = 1/\sqrt{\mu_0\varepsilon_0} = 3 \times 10^8$ m/s.
- $\omega = ck$, or $\nu\lambda = c$.
- They need **no material medium**. They are self-sustaining oscillations of $\vec E$ and $\vec B$ in empty space.
- In vacuum all EM waves have the **same speed**, whatever the wavelength (checked to within a few m/s). This speed is so well known that it is used to define the standard of length.
- They **carry energy**: sunlight brings energy to the Earth; radio and TV signals carry energy. (They also carry momentum: exam extra, see section 8.)
- NCERT Fig. 8.3 is a **linearly polarised** wave: $\vec E$ always along one line ($x$).

:::example{title="NCERT Example 8.1, in short"}
A wave travels along $x$; at one point $\vec E = 6.3\,\hat j$ V/m. Then $B = E/c = 2.1 \times 10^{-8}$ T. $\vec E \times \vec B$ must be along $+\hat i$, and $\hat j \times \hat k = \hat i$, so $\vec B = 2.1 \times 10^{-8}\,\hat k$ T.
:::

## 6. EM waves in a medium

- In a medium of permittivity $\varepsilon$ and permeability $\mu$, the speed is $v = 1/\sqrt{\mu\varepsilon}$. So the speed depends on the electric and magnetic properties of the medium.
- Refractive index of one medium relative to another = ratio of the speeds of light in them (next chapter).
- Entering a medium, the frequency stays the same (it is set by the source); the speed and wavelength change.

## 7. The electromagnetic spectrum

Listed by **decreasing wavelength** (increasing frequency). The bands overlap; names depend roughly on how the waves are made and detected.

**Radio waves** (> 0.1 m)
- Made by accelerated charges in conducting wires (aerials); detected by receivers' aerials.
- Radio and TV, about 500 kHz to 1000 MHz. AM band 530 kHz to 1710 kHz; short wave up to 54 MHz; TV 54 MHz to 890 MHz; FM 88 MHz to 108 MHz.
- Mobile phones use the UHF (ultrahigh frequency) band.

**Microwaves** (0.1 m to 1 mm, GHz range)
- Made by klystrons, magnetrons and Gunn diodes; detected by point-contact diodes.
- Radar for aircraft navigation; radar speed guns (fast balls, tennis serves, cars).
- Microwave ovens: the frequency is chosen to match the resonant frequency of water molecules, so the food heats up.

**Infrared** (1 mm to 700 nm)
- Made by hot bodies and molecules (vibrations of atoms and molecules); detected by thermopiles, bolometers, infrared film.
- Called **heat waves**: water molecules (and $\ce{CO2}$, $\ce{NH3}$) absorb them readily and heat up.
- Uses: infrared lamps in physical therapy; earth satellites (military, crop growth); LEDs in TV remote controls.
- **Greenhouse effect:** the Earth absorbs visible light and re-radiates infrared, which $\ce{CO2}$ and water vapour trap.

**Visible light** (700 nm to 400 nm, about $4 \times 10^{14}$ to $7 \times 10^{14}$ Hz)
- The part our eyes detect. Made when electrons in atoms drop to a lower energy level; detected by the eye, photocells, film.
- Snakes detect infrared; many insects see well into the ultraviolet.

**Ultraviolet** (400 nm to about 1 nm; the NCERT text says down to 0.6 nm)
- Made by special lamps and very hot bodies; the Sun is an important source. Detected by photocells and film.
- Most of the Sun's UV is absorbed by the **ozone layer** at about 40–50 km. Ozone depletion by CFCs (such as freon) is a worldwide concern.
- Too much UV is harmful. It makes the skin produce more melanin (tanning).
- **Ordinary glass absorbs UV**, so you cannot get tanned or sunburnt through a glass window. Welders wear goggles with glass windows.
- Uses: LASIK eye surgery (narrow beams, thanks to short wavelength); UV lamps kill germs in water purifiers.

**X-rays** (about 1 nm to $10^{-3}$ nm; the NCERT text gives about 10 nm down to $10^{-4}$ nm)
- Made by hitting a metal target with high-energy electrons (X-ray tubes), or by inner-shell electrons. Detected by film, Geiger tubes, ionisation chambers.
- Medical diagnosis and treatment of some cancers. They damage living tissue, so avoid needless exposure.

**Gamma rays** (below about $10^{-3}$ nm; the NCERT text says from about $10^{-10}$ m to below $10^{-14}$ m, so they overlap X-rays)
- Made in nuclear reactions and by radioactive nuclei. Detected like X-rays.
- Used in medicine to destroy cancer cells.

:::tip
Order of **increasing frequency**: Radio, Microwave, Infrared, Visible, Ultraviolet, X-rays, Gamma. "**R**ich **M**en **I**n **V**egas **U**se **X**pensive **G**ems." Reverse it for increasing wavelength.
:::

## 8. Energy and momentum (exam extra)

Not in the current NCERT text, but asked under "characteristics of EM waves", which the JEE Main and NEET syllabi both list.
- Energy density: $u_E = \tfrac12\varepsilon_0E^2$ and $u_B = B^2/2\mu_0$. They are **equal**, so the energy is shared equally between $\vec E$ and $\vec B$.
- Average total energy density $\langle u\rangle = \tfrac12\varepsilon_0E_0^2$. Intensity $I = \langle u\rangle c$.
- An EM wave carries momentum $p = U/c$. Falling on a surface it exerts **radiation pressure**: $I/c$ if absorbed, $2I/c$ if reflected (normal incidence).
