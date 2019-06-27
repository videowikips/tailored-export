function isItemInContent(start_time, end_time, item) {
    return item.start_time >= start_time && item.end_time <= end_time;
}

function parseTranscription(transcription) {
    const { results } = transcription;
    const { speaker_labels, items } = results;
    const { segments } = speaker_labels;
    const slidesStartEndTime = [];
    const slidesContent = [];
    segments.forEach((segment, index) => {
        const { start_time, end_time, speaker_label } = segment;
        slidesStartEndTime.push({ start_time: parseFloat(start_time), end_time: parseFloat(end_time), speaker_label });
    });
    slidesStartEndTime.forEach(({ start_time, end_time, speaker_label }) => {
        let content = [];
        let slideItems = [];
        items.forEach((item, index) => {

            if ( isItemInContent(start_time, end_time, item) ||
                // Add to the content if it's a punctuation and the prev item was in the content
                (item.type === 'punctuation' && index !== 0 && isItemInContent(start_time, end_time, items[index - 1]))                
            ) {
                if (item.type === 'punctuation') {
                    content.push(`${item.alternatives[0].content}`);
                } else {
                    content.push(` ${item.alternatives[0].content}`);
                }
                slideItems.push(item);
            }
        })
        slidesContent.push({ startTime: start_time, endTime: end_time, speakerLabel: speaker_label, content: content.join('').trim(), items: slideItems })
    })
    return slidesContent
}

module.exports = {
    parseTranscription,
}