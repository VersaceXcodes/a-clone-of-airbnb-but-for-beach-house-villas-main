import asyncio
from playwright import async_api

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5175", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # Look for any navigation or links to access the villas listing page or try scrolling or waiting for content to load.
        await page.mouse.wheel(0, window.innerHeight)
        

        # Assert villas are listed with multimedia and key information
        villas = await page.query_selector_all('.villa-card')
        assert len(villas) > 0, 'No villas found on the listing page'
        for villa in villas:
            # Check multimedia presence (image or video)
            multimedia = await villa.query_selector('.multimedia')
            assert multimedia is not None, 'Villa multimedia not found'
            # Check key information presence (title, price, location)
            title = await villa.query_selector('.villa-title')
            price = await villa.query_selector('.villa-price')
            location = await villa.query_selector('.villa-location')
            assert title is not None and price is not None and location is not None, 'Key villa information missing'
        # After applying location filter, verify villas match location criteria
        filtered_villas = await page.query_selector_all('.villa-card')
        assert len(filtered_villas) > 0, 'No villas found after applying location filter'
        for villa in filtered_villas:
            loc_text = await (await villa.query_selector('.villa-location')).inner_text()
            assert 'Expected Location' in loc_text, f'Villa location {loc_text} does not match filter'
        # After applying price range filter, verify villas meet price constraints
        filtered_villas = await page.query_selector_all('.villa-card')
        assert len(filtered_villas) > 0, 'No villas found after applying price filter'
        for villa in filtered_villas:
            price_text = await (await villa.query_selector('.villa-price')).inner_text()
            price_value = float(price_text.replace('$','').replace(',',''))
            assert 100 <= price_value <= 500, f'Villa price {price_value} out of range'
        # After applying amenities filter, verify villas have selected amenities
        filtered_villas = await page.query_selector_all('.villa-card')
        assert len(filtered_villas) > 0, 'No villas found after applying amenities filter'
        for villa in filtered_villas:
            amenities = await villa.query_selector_all('.amenity')
            amenity_texts = [await (await amenity.get_property('textContent')).json_value() for amenity in amenities]
            assert 'Pool' in amenity_texts, 'Villa missing required amenity: Pool'
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    