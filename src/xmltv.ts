import type { GridApiResponse } from "./tvlistings.js";

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${YYYY}${MM}${DD}${hh}${mm}${ss} +0000`;
}

export function buildChannelsXml(data: GridApiResponse): string {
  let xml = "";
  for (const channel of data.channels) {
    xml += `  <channel id="${escapeXml(channel.channelId)}">\n`;
    xml += `    <display-name>${escapeXml(channel.callSign)}</display-name>\n`;

    if (channel.affiliateName) {
      xml += `    <display-name>${escapeXml(channel.affiliateName)}</display-name>\n`;
    }

    if (channel.channelNo) {
      xml += `    <display-name>${escapeXml(channel.channelNo)}</display-name>\n`;
    }

    if (channel.thumbnail) {
      xml += `    <icon src="${escapeXml(
        channel.thumbnail.startsWith("http")
          ? channel.thumbnail
          : "https:" + channel.thumbnail,
      )}" />\n`;
    }
    xml += "  </channel>\n";
  }
  return xml;
}

export function buildProgramsXml(data: GridApiResponse): string {
  let xml = "";

  for (const channel of data.channels) {
    for (const event of channel.events) {
      xml += `  <programme start="${formatDate(event.startTime)}" stop="${formatDate(event.endTime)}" channel="${escapeXml(channel.channelId)}">\n`;
      xml += `    <title>${escapeXml(event.program.title)}</title>\n`;

      if (event.program.episodeTitle) {
        xml += `    <sub-title>${escapeXml(event.program.episodeTitle)}</sub-title>\n`;
      }

      if (event.program.shortDesc) {
        xml += `    <desc>${escapeXml(event.program.shortDesc)}</desc>\n`;
      }

      // 1. DATE/YEAR: Crucial for NextPVR movie identification and UI
      if (event.program.releaseYear) {
        xml += `    <date>${escapeXml(event.program.releaseYear)}</date>\n`;
      }

      // 2. CATEGORIES: For grid color-coding (Sports=Green, Movies=Purple, etc.)
      if (event.filter && event.filter.length > 0) {
        for (const f of event.filter) {
          const catName = f.replace("filter-", "");
          const capitalized =
            catName.charAt(0).toUpperCase() + catName.slice(1);
          xml += `    <category lang="en">${escapeXml(capitalized)}</category>\n`;
        }
      }
      if (event.flag && event.flag.includes("Live")) {
        xml += `    <category lang="en">Live</category>\n`;
      }

      // 3. EPISODE NUMBERS: NextPVR relies on these for duplicate detection
      // TMS ID is the most reliable way to avoid recording the same episode twice
      if (event.program.id) {
        xml += `    <episode-num system="dd_progid">${escapeXml(event.program.id)}</episode-num>\n`;
        xml += `    <episode-num system="tms">${escapeXml(event.program.id)}</episode-num>\n`;
      }

      // Season/Episode formatting
      if (event.program.season && event.program.episode) {
        // onscreen is for the user interface
        xml += `    <episode-num system="onscreen">${escapeXml(
          `S${event.program.season.padStart(2, "0")}E${event.program.episode.padStart(2, "0")}`,
        )}</episode-num>\n`;

        // xmltv_ns is zero-indexed per the DTD standard (Season 1 = 0)
        const s = parseInt(event.program.season, 10) - 1;
        const e = parseInt(event.program.episode, 10) - 1;
        xml += `    <episode-num system="xmltv_ns">${s} . ${e} .</episode-num>\n`;
      }

      // 4. AUDIO/SUBTITLES: For UI badges (Stereo, CC, DVS)
      if (event.tags && event.tags.length > 0) {
        xml += `    <audio>\n`;
        if (event.tags.includes("Stereo")) {
          xml += `      <stereo>stereo</stereo>\n`;
        }
        xml += `      <present>yes</present>\n`;
        xml += `    </audio>\n`;

        if (event.tags.includes("CC")) {
          xml += `    <subtitles type="teletext" />\n`;
        }
      }

      if (event.rating) {
        xml += `    <rating system="MPAA"><value>${escapeXml(event.rating)}</value></rating>\n`;
      }

      // 5. NEW vs PREVIOUSLY SHOWN: Correct logic for NextPVR's "New Only" recordings
      if (event.flag && event.flag.includes("New")) {
        xml += `    <new />\n`;
      } else if (event.flag && !event.flag.includes("Live")) {
        // If it's not new and not live, it's a rerun
        xml += `    <previously-shown />\n`;
      }

      if (event.flag && event.flag.includes("Premiere")) {
        xml += `    <premiere />\n`;
      }

      // 6. THUMBNAILS
      if (event.thumbnail) {
        const src = event.thumbnail.startsWith("http")
          ? event.thumbnail
          : "https://zap2it.tmsimg.com/assets/" + event.thumbnail + ".jpg";
        xml += `    <icon src="${escapeXml(src)}" />\n`;
      }

      xml += "  </programme>\n";
    }
  }

  return xml;
}

export function buildXmltv(data: GridApiResponse): string {
  console.log("Building XMLTV file");

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml +=
    '<tv generator-info-name="jef/zap2xml" generator-info-url="https://github.com/jef/zap2xml">\n';
  xml += buildChannelsXml(data);
  xml += buildProgramsXml(data);
  xml += "</tv>\n";

  return xml;
}
