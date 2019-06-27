const { exec } = require('child_process');
// silence threashold in seconds
const SILENECE_THREASHOLD = 1;
// slide duration threashold in seconds
const SLIDE_THREASHOLD = 10;

function findNearestDotPosition(afterTime, items) {

}

function divideSpeakerSlidesByDot(slide) {
    const itemsDuration = parseFloat(slide.items[slide.items.length - 1].end_time) - parseFloat(slide.items[0].start_time);
    if (itemsDuration <= SLIDE_THREASHOLD) return [slide];
    const newSlides = [];
    slide.items.forEach((item) => {
        item.start_time = parseFloat(item.start_time);
        item.end_time = parseFloat(item.end_time);
    })
    let timeSum = slide.items[0].end_time - slide.items[0].start_time;
    let firstItem = slide.items[0];
    let lastItem;
    let content = slide.items[0].alternatives[0].content;
    slide.items.forEach((item, itemIndex) => {
        if (item.type !== 'punctuation') {
            timeSum += (item.end_time - item.start_time);
        }
        if (itemIndex === 0) return;
        if (item.type === 'punctuation') {
            content += `${item.alternatives[0].content}`
        } else {
            lastItem = item;
            content += ` ${item.alternatives[0].content}`
        }
        if (item.alternatives[0].content === '.' && timeSum >= 10) {
            newSlides.push({
                speakerLabel: slide.speakerLabel,
                startTime: firstItem.start_time,
                endTime: lastItem.end_time,
                content,
            })
            content = ''
            firstItem = slide.items[itemIndex + 1];
            timeSum = 0
        } else if (itemIndex === (slide.items.length - 1)) {
            newSlides.push({
                speakerLabel: slide.speakerLabel,
                startTime: firstItem.start_time,
                endTime: lastItem.end_time,
                content,
            })
        }

    })

    return newSlides;
}

function formatTranscribedSlidesToCut(slides, videoDuration) {
    let finalSlides = [];
    const speakersSlides = [];
    // Collect the same speaker's consicutive slides into one;
    for (let index = 0; index < slides.length; index++) {
        const slide = slides[index];
        let slideContent = slide.content;
        let subSlides = [slide];
        let slideStartTime = slide.startTime;
        let slideEndTime = slide.endTime;
        let items = [].concat(slide.items);
        let nextSlide = slides[++index];
        let totalTime = 0;
        while(nextSlide && nextSlide.speakerLabel === slide.speakerLabel) {
            slideContent += ` ${nextSlide.content}`;
            subSlides.push(nextSlide);
            slideEndTime = nextSlide.endTime;
            items = items.concat(nextSlide.items);
            nextSlide = slides[++index];
        }
        index --;
        const speakerSlideData = {
            speakerLabel: slide.speakerLabel,
            startTime: slideStartTime,
            endTime: slideEndTime,
            content: slideContent,
            // subSlides,
            items,
        };
        // If the slide time is greater than the threashold
        // divide it into sub slides splitted by dots
        if (slideEndTime - slideStartTime >= SLIDE_THREASHOLD) {
            // console.log('large slide', slideStartTime, slideEndTime, slideEndTime - slideStartTime);
            // console.log(slideContent);
            // console.log(items);
            // divideSpeakerSlidesByDot(speakerSlideData).forEach((slide) => speakersSlides.push(slide));
            // console.log(`==================== large slide ====================== ${slideEndTime - slideStartTime} \n orignal slide is `)
            // console.log(speakerSlideData);
            // console.log('======================= new slides ============= ');
            // console.log(divideSpeakerSlidesByDot(speakerSlideData))
            divideSpeakerSlidesByDot(speakerSlideData).forEach((s) => speakersSlides.push(s));             
            // speakersSlides.push(speakerSlideData);
        } else {
            speakersSlides.push(speakerSlideData);
        }
        
    }
    // console.log('sldies', slides);
    // console.log('speaker slides', speakersSlides)
    // console.log(slides.length ,speakersSlides.length);
    // console.log(speakersSlides);    
    // speakersSlides.forEach((slide) => {
    //     finalSlides = finalSlides.concat(divideSpeakerSlides(slide));  
    // })
    // slides.forEach((slide, index) => {
    //     if (index >= startIndex && index !== slides.length - 1) {
    //         let slideContent = slide.content;
    //         let items = [slide];
    //         let slideStartTime = slide.startTime;
    //         let slideEndTime = slide.endTime;
    //         let nextSlide = slides[++startIndex];
    //         while(nextSlide && nextSlide.speakerLabel === slide.speakerLabel) {
    //             slideContent += ` ${nextSlide.content}`;
    //             items.push(nextSlide);
    //             slideEndTime = nextSlide.endTime;
    //             nextSlide = slides[++startIndex];
    //         }
    //         console.log('next')
    //         speakersSlides.push({
    //             speakerLabel: slide.speakerLabel,
    //             startTime: slideStartTime,
    //             endTime: slideEndTime,
    //             // content: slideContent,
    //             items,
    //         })
    //     }
    // })
    speakersSlides.forEach((slide, index) => {
        // Move the intro part to a separate slide
        if (index === 0 && slide.startTime > SILENECE_THREASHOLD) {
            finalSlides.push({ startTime: 0, endTime: slide.startTime, content: '' });
        }
        finalSlides.push(slide);
        // Check for silence in between and cut to separate sldies
        if (index !== 0 && index !== speakersSlides.length - 1) {
            const nextSlide = speakersSlides[index + 1];
            console.log(slide.endTime, nextSlide.startTime)
            // Check for silent parts
            if ((nextSlide.startTime) > (slide.endTime + SILENECE_THREASHOLD)) {
                // If the silent part is smaller than the slide threashold, append it to the previous slide
                // Otherwise, create it as a new slide
                const silenceTime = nextSlide.startTime - slide.endTime;
                if (silenceTime > SLIDE_THREASHOLD) {
                    finalSlides.push({
                        startTime: slide.endTime,
                        endTime: nextSlide.startTime,
                        content: '',
                    })
                } else {
                    slide.endTime = nextSlide.startTime;
                }
            } else if (nextSlide.startTime > slide.endTime) {
                slide.endTime = nextSlide.startTime;
            }
        }
        // Move the outro part to a separate slide
        if (index === speakersSlides.length - 1 ) {
            if (slide.endTime + SILENECE_THREASHOLD < videoDuration) {
                finalSlides.push({
                    startTime: slide.endTime,
                    endTime: videoDuration,
                    content: '',
                })
            } else {
                // If outro is not large, just append it to the last slide
                finalSlides[finalSlides.length - 1].endTime = videoDuration;
            }
        }
    })
    return finalSlides;
}

function getRemoteFileDuration(url) {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -i ${url} -show_entries format=duration -v quiet -of csv="p=0"`, (err, stdout, stderr) => {
            if (err) {
                return reject(err);
            }
            if (stderr) {
                return reject(stderr);
            }
            const duration = parseFloat(stdout.replace('\\n', ''));
            resolve(duration);
        })
    })
}

function formatCutTime(seconds) {
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds - (hours * 3600)) / 60);
    seconds = seconds - (hours * 3600) - (minutes * 60);
    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
    let time = hours + ':' + minutes + ':' + seconds;
    if (parseInt(seconds) === seconds || parseInt(seconds) === 0) {
        time += '.000';
    }
    if (time.length < 12) {
        for (let i = 0; i < Array(12 - time.length).length; i++) {
            time += '0';
        }
    }
    return time.substr(0, 12);
}

module.exports = {
    formatCutTime,
    getRemoteFileDuration,
    formatTranscribedSlidesToCut,
}