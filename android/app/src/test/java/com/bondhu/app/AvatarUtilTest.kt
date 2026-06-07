package com.bondhu.app

import com.bondhu.app.ui.common.avColorIndex
import com.bondhu.app.ui.common.initials
import org.junit.Assert.assertEquals
import org.junit.Test

class AvatarUtilTest {
    @Test fun initials_singleWord_oneLetter() {
        assertEquals("A", initials("Ammu"))
    }
    @Test fun initials_twoWords_twoLetters() {
        assertEquals("RB", initials("Rafiq Bhai"))
    }
    @Test fun initials_empty_isQuestionMark() {
        assertEquals("?", initials(""))
    }
    @Test fun avColorIndex_isStableAndInRange() {
        val a = avColorIndex("Rafiq Bhai")
        val b = avColorIndex("Rafiq Bhai")
        assertEquals(a, b)
        assert(a in 0..8)
    }
}
