/*
 * Copyright (C) 2023 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package android.perfetto.cts.app;

import android.app.Activity;
import android.os.Bundle;

public class JavaOomActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        new Thread(() -> {
            try {
                byte[] alloc = new byte[Integer.MAX_VALUE];
                // The return statement below is required to keep the allocation
                // above when generating DEX. Without the return statement there is
                // no way for a debugger to break where `alloc` is in scope and
                // therefore javac will not generate local variable information for it.
                // Without local variable information dexers (both D8 and R8) will
                // remove the dead allocation as without local variable information it
                // is dead even in debug mode. See b/322478366#comment3.
                return;
            } catch (OutOfMemoryError e) {
            }
        }).start();
    }
}
