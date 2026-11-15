#!/usr/bin/env bash
# Study Music — prepare one track for upload at /admin/music (V1/STUDY_MUSIC_PLAN.md §4.3).
#
# Re-encodes any audio file ffmpeg can read to the one format the players expect:
# AAC-LC in .m4a, 96 kbps stereo, 44.1 kHz, loudness about -16 LUFS (two-pass
# loudnorm), metadata stripped, "faststart" so playback starts before the whole
# file arrives. Runs on the uploader's machine only; the server never transcodes.
#
#   scripts/music-prepare.sh <input> <output.m4a> [--loop] [--bitrate 64k|96k]
#
#   --loop     looping moods (nature, white noise): 1.5 s fade in and out, so the
#              tiny gap AAC has when a browser loops it is not heard as a click.
#   --bitrate  64k is enough for noise and nature loops (default 96k).
#
# Only use audio Origin may redistribute (CC0, CC BY 4.0, made by us). Never
# YouTube / Spotify / Pixabay audio. Never commit audio files to git.
#
# Make your own noise (Origin owns it, no credit needed), e.g. 3 minutes of brown noise:
#   ffmpeg -f lavfi -i "anoisesrc=color=brown:duration=180:amplitude=0.5" -ac 2 /tmp/brown.wav
#   scripts/music-prepare.sh /tmp/brown.wav brown-noise.m4a --loop --bitrate 64k
set -euo pipefail

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

[[ $# -ge 2 ]] || usage
in=$1
out=$2
shift 2
loop=0
bitrate=96k
while [[ $# -gt 0 ]]; do
  case $1 in
    --loop) loop=1 ;;
    --bitrate)
      shift
      [[ ${1:-} =~ ^(48|64|80|96|112|128)k$ ]] || { echo "--bitrate must be 48k..128k" >&2; exit 2; }
      bitrate=$1
      ;;
    *) usage ;;
  esac
  shift
done

command -v ffmpeg >/dev/null || { echo "ffmpeg is not installed (sudo apt install ffmpeg)." >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe is not installed (comes with ffmpeg)." >&2; exit 1; }
[[ -f $in ]] || { echo "No such file: $in" >&2; exit 1; }
[[ $out == *.m4a ]] || { echo "The output must end in .m4a" >&2; exit 1; }

duration=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$in")
dur_s=${duration%.*}
if [[ -z $dur_s || $dur_s -lt 20 || $dur_s -gt 1200 ]]; then
  echo "Tracks must be 20 seconds to 20 minutes long (this one: ${duration:-unknown} s)." >&2
  exit 1
fi

# Pass 1: measure loudness.
stats=$(ffmpeg -hide_banner -nostats -i "$in" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 |
  awk '/^\{/{p=1} p{print} /^\}/{p=0}')
get() { printf '%s' "$stats" | sed -n "s/.*\"$1\" : \"\\([^\"]*\\)\".*/\\1/p"; }
measured="measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset)"

filters="loudnorm=I=-16:TP=-1.5:LRA=11:${measured}:linear=true,aresample=44100"
if [[ $loop -eq 1 ]]; then
  fade_out_start=$(awk -v d="$duration" 'BEGIN { printf "%.2f", d - 1.5 }')
  filters="$filters,afade=t=in:d=1.5,afade=t=out:st=${fade_out_start}:d=1.5"
fi

# Pass 2: normalise and encode.
ffmpeg -hide_banner -loglevel error -y -i "$in" -vn -map_metadata -1 \
  -af "$filters" -ac 2 -ar 44100 -c:a aac -profile:a aac_low -b:a "$bitrate" \
  -movflags +faststart "$out"

size=$(stat -c %s "$out")
if [[ $size -gt 15728640 ]]; then
  echo "Done, but $out is $size bytes: over the 15 MB upload limit. Use a lower --bitrate or a shorter track." >&2
  exit 1
fi
out_dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out")
echo "Ready: $out ($(awk -v s="$size" 'BEGIN { printf "%.2f", s / 1048576 }') MB, ${out_dur%.*} s, AAC $bitrate, -16 LUFS)."
echo "SHA-256: $(sha256sum "$out" | cut -d' ' -f1)"
